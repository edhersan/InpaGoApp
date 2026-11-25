import { useEffect, useState, type ReactElement } from 'react';
import { Image, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { File as ExpoFile, Paths } from 'expo-file-system';
import { cleanupTempFileSafe } from '@/api/client';
import { isTrustedApiOrigin } from '@/api/config';
import { SessionStorage } from '@/auth/storage';

export interface ProtectedAvatarProps {
  uri: string;
  accessToken: string | null;
  fullName: string;
  size?: number;
  webSize?: number;
  borderColor?: string;
  expandable?: boolean;
}

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function buildSafeCacheFileName(uri: string): string {
  const numericMatch = uri.match(/\/usuarios\/(\d+)\/foto/);
  const idPart = numericMatch?.[1] ?? 'user';
  return `avatar-${idPart}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.img`;
}

export function ProtectedAvatar({
  uri,
  accessToken,
  fullName,
  size = 54,
  webSize,
  borderColor = '#07152F',
  expandable = true,
}: ProtectedAvatarProps): ReactElement {
  const [resolvedUri, setResolvedUri] = useState<string | null>(null);
  const [failed, setFailed] = useState<boolean>(false);
  const [previewOpen, setPreviewOpen] = useState<boolean>(false);

  const isTrusted = Boolean(uri && isTrustedApiOrigin(uri));
  const resolvedSize = Platform.OS === 'web' ? (webSize ?? Math.round(size * 1.25)) : size;
  const radius = resolvedSize / 2;

  useEffect(() => {
    setFailed(false);
    setResolvedUri(null);
    setPreviewOpen(false);

    if (!isTrusted) {
      return;
    }

    let cancelled = false;
    let tempUriToClean: string | null = null;

    const loadProtectedImage = async (): Promise<void> => {
      try {
        const token = (await SessionStorage.getAccessToken()) ?? accessToken;
        if (!token) {
          if (!cancelled) setFailed(true);
          return;
        }

        if (Platform.OS === 'web') {
          const response = await fetch(uri, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          if (!response.ok) {
            if (!cancelled) setFailed(true);
            return;
          }
          const blob = await response.blob();
          if (blob.size === 0) {
            if (!cancelled) setFailed(true);
            return;
          }
          tempUriToClean = URL.createObjectURL(blob);
          if (!cancelled) {
            setResolvedUri(tempUriToClean);
          } else {
            cleanupTempFileSafe(tempUriToClean);
          }
          return;
        }

        const destinationFile = new ExpoFile(Paths.cache, buildSafeCacheFileName(uri));
        const downloaded = await ExpoFile.downloadFileAsync(uri, destinationFile, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          idempotent: true,
        });

        tempUriToClean = downloaded.uri;
        if (!cancelled) {
          setResolvedUri(downloaded.uri);
        } else {
          cleanupTempFileSafe(downloaded.uri);
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    };

    void loadProtectedImage();

    return () => {
      cancelled = true;
      if (tempUriToClean) {
        cleanupTempFileSafe(tempUriToClean);
      }
    };
  }, [accessToken, isTrusted, uri]);

  const fallbackAvatar = (
    <View
      style={[
        styles.fallback,
        { width: resolvedSize, height: resolvedSize, borderRadius: radius, borderColor },
      ]}
    >
      <Text style={[styles.initials, { fontSize: Math.max(13, Math.round(resolvedSize * 0.32)) }]}>
        {getInitials(fullName)}
      </Text>
    </View>
  );

  if (!isTrusted || failed || !resolvedUri) {
    return fallbackAvatar;
  }

  const imageSource = { uri: resolvedUri };

  const avatarImage = (
    <Image
      onError={() => setFailed(true)}
      source={imageSource}
      style={{
        width: resolvedSize,
        height: resolvedSize,
        borderRadius: radius,
        borderWidth: 2,
        borderColor,
      }}
    />
  );

  if (!expandable) {
    return avatarImage;
  }

  return (
    <>
      <Pressable
        accessibilityLabel={`Ampliar fotografía de ${fullName}`}
        accessibilityRole="button"
        onPress={() => setPreviewOpen(true)}
        style={({ pressed }) => [styles.pressableWrap, pressed && styles.pressed]}
      >
        {avatarImage}
      </Pressable>

      <Modal
        animationType="fade"
        onRequestClose={() => setPreviewOpen(false)}
        transparent
        visible={previewOpen}
      >
        <Pressable onPress={() => setPreviewOpen(false)} style={styles.lightboxBackdrop}>
          <Pressable onPress={(event) => event.stopPropagation()} style={styles.lightboxCard}>
            <Text style={styles.lightboxTitle}>{fullName}</Text>
            <Image
              resizeMode="contain"
              source={imageSource}
              style={styles.lightboxImage}
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => setPreviewOpen(false)}
              style={styles.closeBtn}
            >
              <Text style={styles.closeBtnText}>Cerrar</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pressableWrap: {
    alignSelf: 'center',
  },
  pressed: {
    opacity: 0.82,
  },
  fallback: {
    backgroundColor: '#1E293B',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  lightboxBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(7, 21, 47, 0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  lightboxCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    alignItems: 'center',
    gap: 14,
    maxWidth: 400,
    width: '100%',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  lightboxTitle: {
    color: '#07152F',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  lightboxImage: {
    width: Platform.OS === 'web' ? 340 : 280,
    height: Platform.OS === 'web' ? 340 : 280,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
  },
  closeBtn: {
    backgroundColor: '#07152F',
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 10,
  },
  closeBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
