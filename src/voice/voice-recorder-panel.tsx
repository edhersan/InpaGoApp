import { useEffect, useRef, useState, type ReactElement } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { File as ExpoFile } from 'expo-file-system';
import { appendFileToFormData, cleanupTempFileSafe } from '@/api/client';
import { AudioWaveVisualizer } from '@/voice/audio-wave-visualizer';

export interface RecordedAudioClip {
  uri: string;
  fileName: string;
  mimeType: string;
  durationMs: number;
  blob?: Blob;
}

export interface VoiceRecorderPanelProps {
  title: string;
  promptHint: string;
  submitLabel: string;
  maxDurationSeconds?: number;
  isSubmitting?: boolean;
  onClipReady: (clip: RecordedAudioClip) => Promise<void> | void;
}

const MAX_AUDIO_BYTES = 4 * 1024 * 1024;
const MIC_CONSENT_TITLE = 'Consentimiento de Micrófono (UNINPAHU)';
const MIC_CONSENT_MESSAGE =
  'Inpa_Go grabará un clip breve de tu voz (3 a 5 segundos) únicamente para validar tu identidad vocal en el proceso académico de asistencia. El micrófono no permanece activo fuera de esta grabación.';

function requestExplicitMicConsent(): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      return Promise.resolve(window.confirm(`${MIC_CONSENT_TITLE}\n\n${MIC_CONSENT_MESSAGE}`));
    }
    return Promise.resolve(true);
  }

  return new Promise<boolean>((resolve) => {
    Alert.alert(MIC_CONSENT_TITLE, MIC_CONSENT_MESSAGE, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Permitir grabación', onPress: () => resolve(true) },
    ]);
  });
}

export async function appendAudioClipToFormData(
  formData: FormData,
  fieldName: string,
  clip: RecordedAudioClip
): Promise<void> {
  if (Platform.OS === 'web') {
    const audioBlob = clip.blob ?? (await (await fetch(clip.uri)).blob());
    if (audioBlob.size > MAX_AUDIO_BYTES) {
      throw new Error('El clip de voz supera el límite máximo permitido de 4 MB.');
    }
    await appendFileToFormData(formData, fieldName, {
      uri: clip.uri,
      name: clip.fileName,
      type: clip.mimeType,
      blob: audioBlob,
    });
    return;
  }

  const localFile = new ExpoFile(clip.uri);
  if (localFile.exists && typeof localFile.size === 'number' && localFile.size > MAX_AUDIO_BYTES) {
    throw new Error('El clip de voz supera el límite máximo permitido de 4 MB.');
  }

  await appendFileToFormData(formData, fieldName, {
    uri: clip.uri,
    name: clip.fileName,
    type: clip.mimeType,
  });
}

export function VoiceRecorderPanel({
  title,
  promptHint,
  submitLabel,
  maxDurationSeconds = 5,
  isSubmitting = false,
  onClipReady,
}: VoiceRecorderPanelProps): ReactElement {
  const audioRecorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    isMeteringEnabled: true,
  });
  const recorderState = useAudioRecorderState(audioRecorder, 150);

  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [recordedClip, setRecordedClip] = useState<RecordedAudioClip | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const webRecorderRef = useRef<MediaRecorder | null>(null);
  const webChunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const clearTimer = (): void => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      clearTimer();
      if (webRecorderRef.current && webRecorderRef.current.state !== 'inactive') {
        webRecorderRef.current.stop();
      }
    };
  }, []);

  const stopRecording = async (): Promise<void> => {
    clearTimer();
    const durationMs = Math.max(500, Date.now() - startTimeRef.current);

    if (Platform.OS === 'web') {
      const recorder = webRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        setIsRecording(false);
        return;
      }

      await new Promise<void>((resolve) => {
        recorder.onstop = () => {
          const mimeType = recorder.mimeType || 'audio/webm';
          const blob = new Blob(webChunksRef.current, { type: mimeType });
          const extension = mimeType.includes('mp4') ? 'm4a' : 'webm';
          const uri = URL.createObjectURL(blob);
          setRecordedClip({
            uri,
            fileName: `voz-inpago-${Date.now()}.${extension}`,
            mimeType,
            durationMs,
            blob,
          });
          recorder.stream.getTracks().forEach((track) => track.stop());
          webRecorderRef.current = null;
          webChunksRef.current = [];
          setIsRecording(false);
          resolve();
        };
        recorder.stop();
      });
      return;
    }

    try {
      await audioRecorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
      const uri = audioRecorder.uri;
      setIsRecording(false);

      if (!uri) {
        setErrorMessage('No se pudo recuperar el archivo de audio grabado.');
        return;
      }

      setRecordedClip({
        uri,
        fileName: `voz-inpago-${Date.now()}.m4a`,
        mimeType: 'audio/m4a',
        durationMs,
      });
    } catch (error) {
      setIsRecording(false);
      setErrorMessage(error instanceof Error ? error.message : 'Error al finalizar la grabación de voz.');
    }
  };

  const startRecording = async (): Promise<void> => {
    setErrorMessage(null);
    if (recordedClip?.uri) {
      cleanupTempFileSafe(recordedClip.uri);
    }
    setRecordedClip(null);
    setElapsedMs(0);

    const consented = await requestExplicitMicConsent();
    if (!consented) {
      setErrorMessage('Se requiere tu consentimiento para grabar el clip de voz.');
      return;
    }

    try {
      if (Platform.OS === 'web') {
        if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
          throw new Error('Tu navegador no soporta grabación de audio con micrófono.');
        }

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        webChunksRef.current = [];
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            webChunksRef.current.push(event.data);
          }
        };
        recorder.start();
        webRecorderRef.current = recorder;
      } else {
        const permission = await requestRecordingPermissionsAsync();
        if (!permission.granted) {
          throw new Error('Permiso de micrófono denegado. Habilítalo en los ajustes del dispositivo.');
        }

        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
        });

        await audioRecorder.prepareToRecordAsync();
        audioRecorder.record();
      }

      startTimeRef.current = Date.now();
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        setElapsedMs(elapsed);
        if (elapsed >= maxDurationSeconds * 1000) {
          void stopRecording();
        }
      }, 150);
    } catch (error) {
      clearTimer();
      setIsRecording(false);
      setErrorMessage(error instanceof Error ? error.message : 'No fue posible iniciar la grabación de voz.');
    }
  };

  const handleSubmitClip = async (): Promise<void> => {
    if (!recordedClip) {
      return;
    }
    const clipToCleanup = recordedClip.uri;
    setErrorMessage(null);
    try {
      await onClipReady(recordedClip);
      cleanupTempFileSafe(clipToCleanup);
      setRecordedClip(null);
      setElapsedMs(0);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Error al enviar el clip de voz.');
    }
  };

  const elapsedSeconds = (elapsedMs / 1000).toFixed(1);
  const liveMeteringDb = Platform.OS === 'web' ? null : (recorderState.metering ?? null);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.hint}>{promptHint}</Text>

      <AudioWaveVisualizer isRecording={isRecording} meteringDb={liveMeteringDb} />

      <View style={styles.metaRow}>
        <Text style={styles.timerText}>
          {isRecording
            ? `Grabando: ${elapsedSeconds}s / ${maxDurationSeconds}.0s`
            : recordedClip
              ? `Clip listo (${(recordedClip.durationMs / 1000).toFixed(1)}s)`
              : `Duración máxima: ${maxDurationSeconds} segundos`}
        </Text>
      </View>

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      <View style={styles.actionsRow}>
        {!isRecording ? (
          <Pressable
            accessibilityRole="button"
            disabled={isSubmitting}
            onPress={() => {
              void startRecording();
            }}
            style={({ pressed }) => [styles.recordButton, pressed && styles.pressed]}
          >
            <Text style={styles.recordButtonText}>
              {recordedClip ? 'Grabar de nuevo' : 'Iniciar grabación'}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              void stopRecording();
            }}
            style={({ pressed }) => [styles.stopButton, pressed && styles.pressed]}
          >
            <Text style={styles.stopButtonText}>Detener grabación</Text>
          </Pressable>
        )}

        {recordedClip && !isRecording ? (
          <Pressable
            accessibilityRole="button"
            disabled={isSubmitting}
            onPress={() => {
              void handleSubmitClip();
            }}
            style={({ pressed }) => [
              styles.submitButton,
              pressed && styles.pressed,
              isSubmitting && styles.disabled,
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.submitButtonText}>{submitLabel}</Text>
            )}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 10,
  },
  title: {
    color: '#07152F',
    fontSize: 15,
    fontWeight: '700',
  },
  hint: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timerText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '600',
  },
  errorText: {
    color: '#B42318',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    fontSize: 12,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  recordButton: {
    backgroundColor: '#07152F',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    flexGrow: 1,
    alignItems: 'center',
  },
  recordButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  stopButton: {
    backgroundColor: '#B42318',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    flexGrow: 1,
    alignItems: 'center',
  },
  stopButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  submitButton: {
    backgroundColor: '#F0440B',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    flexGrow: 1,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.6,
  },
});
