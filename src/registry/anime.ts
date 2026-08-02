import {
  createAnimeExtensionRegistry,
  type AnimeExtensionCapability,
  type AnimeExtensionDefinition,
  type AnimeExtensionManifest,
  type AnimeExtensionRegistry,
  type AnimeParser,
} from '@middlegear/kenjitsu-extensions';

export type {
  AnimeExtensionCapability,
  AnimeExtensionDefinition,
  AnimeExtensionManifest,
  AnimeExtensionRegistry,
  AnimeParser,
};

export const animeExtensionRegistry = createAnimeExtensionRegistry({
  baseUrls: {
    anizone: process.env.ANIZONEURL,
    anikoto: process.env.ANIKOTOURL,
    anidb: process.env.ANIDBURL,
    anibd: process.env.ANIBDURL,
    animeheaven: process.env.ANIMEHEAVENURL,
  },
});
