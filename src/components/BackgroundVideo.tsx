import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useTheme } from '../themes/ThemeProvider';

export const BackgroundVideo: React.FC = () => {
  const { theme } = useTheme();
  const player = useVideoPlayer(theme.video, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  const didMountRef = useRef(false);

  // useVideoPlayer's setup callback handles the initial source.
  // Only swap on subsequent theme changes.
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    if (!player) return;
    player.replace(theme.video);
    player.muted = true;
    player.loop = true;
    player.play();
  }, [theme.video, player]);

  // Wrap in a pointerEvents="none" View so the native VideoView doesn't
  // intercept taps/long-presses meant for PlaySurface, MagicButton, or the
  // hidden AdultPanel hotspot. With placeholder content this wasn't an
  // issue, but a real playing video activates the native view's touch handling.
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <VideoView
        style={StyleSheet.absoluteFill}
        player={player}
        contentFit="cover"
        nativeControls={false}
        allowsPictureInPicture={false}
      />
    </View>
  );
};
