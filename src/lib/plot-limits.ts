/**
 * Per-language limits for plots (source: APK constants, ds-max PHASE3 §6, verified live:
 * the server rejects a 21-character plot name at PUT with PLOT_NAME_CONSTRAINT_VIOLATION).
 * The language is the plot's `language` field; JAPANESE is the fallback.
 */

export type PlotLanguage = "KOREAN" | "JAPANESE" | "ENGLISH"

interface PerLanguage {
  KOREAN: number
  JAPANESE: number
  ENGLISH: number
}

const T = (ko: number, ja: number, en: number): PerLanguage => ({ KOREAN: ko, JAPANESE: ja, ENGLISH: en })

const PER_LANGUAGE = {
  name: T(20, 20, 45),
  characterName: T(10, 10, 25),
  chatProfileName: T(20, 20, 50),
  chatProfileSummary: T(50, 50, 100),
  chatProfileDescription: T(1000, 1000, 2000),
  shortDescription: T(40, 40, 85),
  longDescription: T(2400, 2400, 5400),
  creatorComment: T(150, 150, 330),
  exampleTotal: T(2000, 2000, 4500),
  introTotal: T(1500, 1500, 3300),
  hashtagLength: T(20, 20, 45),
  rankName: T(12, 12, 24),
  liveChatName: T(10, 10, 20),
  liveChatText: T(30, 30, 60),
} as const

/** Limits that do not depend on the language. */
const FIXED = {
  characters: 10,
  chatProfiles: 5,
  hashtags: 10,
  introMessages: 30,
  about: 10000,
  lorebooks: 5,
  introImages: 5,
  coverImages: 10,
  cyoaChoices: 5,
  cyoaTitle: 20,
  cyoaPreview: 60,
  bgmTracks: 12,
  questCount: 8,
  questTitle: 80,
  anonymousBoardName: 30,
  rankCount: 5,
  rankMinCount: 2,
  rankDescription: 200,
  rankTitle: 100,
  rankMembers: 5,
  relationships: 20,
  relationshipParticipants: 15,
  relationshipNameMax: 50,
  suddenEventCount: 5,
  suddenEventChars: 100,
  liveChatEntries: 5,
  phoneTargets: 10,
  imageMinEdge: 224,
} as const

export interface PlotLimits {
  readonly language: PlotLanguage
  readonly name: number
  readonly characterName: number
  readonly characters: number
  readonly chatProfiles: number
  readonly chatProfileName: number
  readonly chatProfileSummary: number
  readonly chatProfileDescription: number
  readonly shortDescription: number
  readonly longDescription: number
  readonly creatorComment: number
  readonly exampleTotal: number
  readonly introTotal: number
  readonly introMessages: number
  readonly about: number
  readonly hashtags: number
  readonly hashtagLength: number
  readonly introImages: number
  readonly coverImages: number
  readonly cyoaChoices: number
  readonly cyoaTitle: number
  readonly cyoaPreview: number
  readonly lorebooks: number
  readonly bgmTracks: number
  readonly questCount: number
  readonly questTitle: number
  readonly anonymousBoardName: number
  readonly rankCount: number
  readonly rankMinCount: number
  readonly rankName: number
  readonly rankDescription: number
  readonly rankTitle: number
  readonly rankMembers: number
  readonly relationships: number
  readonly relationshipParticipants: number
  readonly relationshipNameMax: number
  readonly suddenEventCount: number
  readonly suddenEventChars: number
  readonly liveChatEntries: number
  readonly liveChatName: number
  readonly liveChatText: number
  readonly phoneTargets: number
  readonly imageMinEdge: number
}

export function plotLanguageOf(raw: unknown): PlotLanguage {
  return raw === "KOREAN" || raw === "ENGLISH" ? raw : "JAPANESE"
}

export function getPlotLimits(rawLanguage: unknown): PlotLimits {
  const lang = plotLanguageOf(rawLanguage)
  const pick = (table: PerLanguage) => table[lang]
  return {
    language: lang,
    name: pick(PER_LANGUAGE.name),
    characterName: pick(PER_LANGUAGE.characterName),
    characters: FIXED.characters,
    chatProfiles: FIXED.chatProfiles,
    chatProfileName: pick(PER_LANGUAGE.chatProfileName),
    chatProfileSummary: pick(PER_LANGUAGE.chatProfileSummary),
    chatProfileDescription: pick(PER_LANGUAGE.chatProfileDescription),
    shortDescription: pick(PER_LANGUAGE.shortDescription),
    longDescription: pick(PER_LANGUAGE.longDescription),
    creatorComment: pick(PER_LANGUAGE.creatorComment),
    exampleTotal: pick(PER_LANGUAGE.exampleTotal),
    introTotal: pick(PER_LANGUAGE.introTotal),
    introMessages: FIXED.introMessages,
    about: FIXED.about,
    hashtags: FIXED.hashtags,
    hashtagLength: pick(PER_LANGUAGE.hashtagLength),
    introImages: FIXED.introImages,
    coverImages: FIXED.coverImages,
    cyoaChoices: FIXED.cyoaChoices,
    cyoaTitle: FIXED.cyoaTitle,
    cyoaPreview: FIXED.cyoaPreview,
    lorebooks: FIXED.lorebooks,
    bgmTracks: FIXED.bgmTracks,
    questCount: FIXED.questCount,
    questTitle: FIXED.questTitle,
    anonymousBoardName: FIXED.anonymousBoardName,
    rankCount: FIXED.rankCount,
    rankMinCount: FIXED.rankMinCount,
    rankName: pick(PER_LANGUAGE.rankName),
    rankDescription: FIXED.rankDescription,
    rankTitle: FIXED.rankTitle,
    rankMembers: FIXED.rankMembers,
    relationships: FIXED.relationships,
    relationshipParticipants: FIXED.relationshipParticipants,
    relationshipNameMax: FIXED.relationshipNameMax,
    suddenEventCount: FIXED.suddenEventCount,
    suddenEventChars: FIXED.suddenEventChars,
    liveChatEntries: FIXED.liveChatEntries,
    liveChatName: pick(PER_LANGUAGE.liveChatName),
    liveChatText: pick(PER_LANGUAGE.liveChatText),
    phoneTargets: FIXED.phoneTargets,
    imageMinEdge: FIXED.imageMinEdge,
  }
}

/** Counts user-perceived characters (code points), as the editor counters do. */
export function countChars(text: string | null | undefined): number {
  return text ? Array.from(text).length : 0
}

/** Japanese messages for the limits. Every number comes from the table above. */
export const LIMIT_TEXT = {
  name: (max: number) => `タイトルは${max}文字以内で入力してください`,
  characterName: (max: number) => `キャラ名は${max}文字まで入力可能です`,
  characters: (max: number) => `キャラクターは最大${max}体まで追加可能です`,
  chatProfiles: (max: number) => `トークプロフィールは最大${max}件まで追加できます`,
  chatProfileName: (max: number) => `トークプロフィール名は${max}文字以内で入力してください`,
  chatProfileSummary: (max: number) => `概要は${max}文字以内で入力してください`,
  chatProfileDescription: (max: number) => `説明は${max}文字以内で入力してください`,
  shortDescription: (max: number) => `簡単な説明文は${max}文字以内で入力してください`,
  longDescription: (max: number) => `説明は${max}文字以内で入力してください`,
  creatorComment: (max: number) => `クリエイターコメントは${max}文字以内で入力してください`,
  exampleTotal: (max: number) => `会話例は全${max}字以内で作成してください`,
  introTotal: (max: number) => `イントロは${max}文字以内で入力してください`,
  introMessages: (max: number) => `イントロの項目は最大${max}件までです`,
  about: (max: number) => `紹介文は${max}文字以内で入力してください`,
  hashtags: (max: number) => `ハッシュタグは最大${max}つまで選択可能です`,
  hashtagLength: (max: number) => `ハッシュタグは${max}文字以内で入力してください`,
  lorebooks: (max: number) => `設定集は1つのプロットに最大${max}つまで連動できます`,
  cyoaChoices: (max: number) => `選択肢は最大${max}個までです`,
  cyoaTitle: (max: number) => `選択肢のタイトルは${max}文字以内で入力してください`,
  cyoaPreview: (max: number) => `選択肢の本文は${max}文字以内で入力してください`,
  nameChars: "使用できない文字が含まれています",
} as const
