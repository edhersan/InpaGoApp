import { Platform } from 'react-native';
import * as Speech from 'expo-speech';

export function stopSpeaking(): void {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    return;
  }
  void Speech.stop();
}

export async function speakSpanish(text: string): Promise<void> {
  const cleanText = text.trim();
  if (!cleanText) {
    return;
  }

  stopSpeaking();

  if (Platform.OS === 'web') {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    await new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'es-CO';
      utterance.rate = 0.98;
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      window.speechSynthesis.speak(utterance);
    });
    return;
  }

  await new Promise<void>((resolve) => {
    Speech.speak(cleanText, {
      language: 'es-CO',
      rate: 0.98,
      onDone: () => resolve(),
      onStopped: () => resolve(),
      onError: () => resolve(),
    });
  });
}
