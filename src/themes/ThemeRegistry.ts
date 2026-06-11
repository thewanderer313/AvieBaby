// src/themes/ThemeRegistry.ts
import { Theme } from './types';

export const THEMES: Theme[] = [
  {
    id: 'sleepy-ocean',
    name: 'Sleepy Ocean',
    video: require('../../assets/themes/sleepy-ocean/background.mp4'),
    music: [
      require('../../assets/themes/sleepy-ocean/music/track-1.mp3'),
      require('../../assets/themes/sleepy-ocean/music/track-2.mp3'),
    ],
    characters: [
      {
        id: 'whale',
        label: 'Whale',
        image: require('../../assets/themes/sleepy-ocean/characters/whale.png'),
        voice: require('../../assets/themes/sleepy-ocean/voices/whale.mp3'),
      },
      {
        id: 'jellyfish',
        label: 'Jellyfish',
        image: require('../../assets/themes/sleepy-ocean/characters/jellyfish.png'),
        voice: require('../../assets/themes/sleepy-ocean/voices/jellyfish.mp3'),
      },
      {
        id: 'starfish',
        label: 'Starfish',
        image: require('../../assets/themes/sleepy-ocean/characters/starfish.png'),
        voice: require('../../assets/themes/sleepy-ocean/voices/starfish.mp3'),
      },
    ],
    sparkleColors: ['#7FE7FF', '#4FC3F7', '#B388FF', '#80DEEA', '#A5D6A7'],
    buttonColor: '#4FC3F7',
  },
  {
    id: 'sparkle-space',
    name: 'Sparkle Space',
    video: require('../../assets/themes/sparkle-space/background.mp4'),
    music: [
      require('../../assets/themes/sparkle-space/music/track-1.mp3'),
      require('../../assets/themes/sparkle-space/music/track-2.mp3'),
    ],
    characters: [
      {
        id: 'rocket',
        label: 'Rocket',
        image: require('../../assets/themes/sparkle-space/characters/rocket.png'),
        voice: require('../../assets/themes/sparkle-space/voices/rocket.mp3'),
      },
      {
        id: 'alien',
        label: 'Alien',
        image: require('../../assets/themes/sparkle-space/characters/alien.png'),
        voice: require('../../assets/themes/sparkle-space/voices/alien.mp3'),
      },
      {
        id: 'comet',
        label: 'Comet',
        image: require('../../assets/themes/sparkle-space/characters/comet.png'),
        voice: require('../../assets/themes/sparkle-space/voices/comet.mp3'),
      },
    ],
    sparkleColors: ['#E1BEE7', '#FFF59D', '#80D8FF', '#F8BBD0', '#FFCC80'],
    buttonColor: '#E1BEE7',
  },
  {
    id: 'disco-jungle',
    name: 'Disco Jungle',
    video: require('../../assets/themes/disco-jungle/background.mp4'),
    music: [
      require('../../assets/themes/disco-jungle/music/track-1.mp3'),
      require('../../assets/themes/disco-jungle/music/track-2.mp3'),
    ],
    characters: [
      {
        id: 'banana',
        label: 'Banana',
        image: require('../../assets/themes/disco-jungle/characters/banana.png'),
        voice: require('../../assets/themes/disco-jungle/voices/banana.mp3'),
      },
      {
        id: 'monkey',
        label: 'Monkey',
        image: require('../../assets/themes/disco-jungle/characters/monkey.png'),
        voice: require('../../assets/themes/disco-jungle/voices/monkey.mp3'),
      },
      {
        id: 'parrot',
        label: 'Parrot',
        image: require('../../assets/themes/disco-jungle/characters/parrot.png'),
        voice: require('../../assets/themes/disco-jungle/voices/parrot.mp3'),
      },
    ],
    sparkleColors: ['#FFEB3B', '#FF7043', '#26C6DA', '#AB47BC', '#66BB6A', '#FF4081'],
    buttonColor: '#FFEB3B',
  },
];

export const THEME_IDS = THEMES.map((t) => t.id);
