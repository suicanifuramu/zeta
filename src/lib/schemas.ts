import { z } from "zod"

/**
 * Validation schemas for API response shapes.
 *
 * Mirrors the narrowed interfaces in `src/lib/types.ts` so that the
 * narrowing assertions added in Cycles 5–8 are backed by runtime checks.
 * Source of truth for the wire shape; if a server response drifts from
 * the schema, the caller's `.catch()` chain fires and the user sees a
 * toast via `sonner`.
 */

// `CharacterImageResponse` — used by `<CharacterDetailSheet>`.
export const CharacterImageResponseSchema = z.object({
  images: z.array(
    z.object({
      imageUrl: z.string(),
      aspectRatio: z.number(),
    })
  ),
})

// `UserChatProfile` — used by `<ProfileSelectSheet>` after creation.
export const UserChatProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullish(),
  isDefault: z.boolean().optional(),
  profileImageUrl: z.string().nullish(),
  selected: z.boolean().optional(),
})

// `MyPlotChatProfileResponse` — used by `<MyProfileSheet>` (primary path).
export const MyPlotChatProfileResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  roomId: z.string(),
  plotChatProfileId: z.string().nullish(),
  name: z.string(),
  imageUrl: z.string().nullish(),
  summary: z.string().nullish(),
  description: z.string().nullish(),
  selected: z.boolean().optional(),
})

// `SelectedUserPersonaResponse` — used by `<MyProfileSheet>` (fallback path).
export const SelectedUserPersonaResponseSchema = z.object({
  name: z.string(),
  profileImageUrl: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
})

/**
 * `ImageUploadResponse` — used after uploading a chat profile image.
 */
export const ImageUploadResponseSchema = z.object({
  imageUrl: z.string(),
})

/**
 * `PlotDetailResponse` — used by `<PlotDetailDialog>`.
 *
 * Includes the loose fallback fields that the dialog reads via `dExtra`
 * (the `Record<string, unknown>` intersection), which would otherwise
 * be lost if we used `.strip()` semantics — every field the consumer
 * actually reads is declared optional above, so call sites stay green.
 */
export const PlotDetailResponseSchema = z.object({
  // Plot base fields
  id: z.string(),
  name: z.string(),
  imageUrl: z.string().nullish(),
  shortDescription: z.string().nullish(),
  interactionCount: z.number().optional(),
  hashtags: z.array(z.string()).optional(),
  rank: z.number().optional(),
  rankDiff: z.number().optional(),
  isNew: z.boolean().optional(),
  characters: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        imageUrl: z.string().nullish(),
        description: z.string().nullish(),
      })
    )
    .optional(),
  // PlotDetailResponse-specific fields
  longDescription: z.string().nullish(),
  initialRoomImageUrl: z.string().nullish(),
  creator: z
    .object({
      id: z.string(),
      nickname: z.string(),
      username: z.string(),
    })
    .optional(),
  isAboutPublic: z.boolean().optional(),
  about: z
    .object({
      contents: z.array(
        z.object({
          content: z.string().nullish(),
          text: z.string().nullish(),
        })
      ),
      characters: z.array(
        z.object({
          characterId: z.string().nullish(),
          description: z.string().nullish(),
        })
      ),
    })
    .nullish(),
  intros: z
    .array(
      z.object({
        conversation: z
          .object({
            messages: z
              .array(
                z.union([
                  z.object({
                    senderId: z.string().nullable(),
                    content: z.string(),
                    position: z.string().nullish(),
                    type: z.string().optional(),
                  }),
                  z.object({
                    type: z.literal("image"),
                    id: z.string(),
                    url: z.string(),
                    caption: z.string().nullish(),
                    aspectRatio: z.number().optional(),
                    fileName: z.string().nullish(),
                  }),
                  z.object({
                    type: z.literal("infoBox"),
                    infoBox: z
                      .object({
                        scenes: z
                          .array(
                            z.object({
                              type: z.string().nullish(),
                              value: z.string().nullish(),
                            })
                          )
                          .optional(),
                        characters: z
                          .array(
                            z.object({
                              characterId: z.string().nullish(),
                              items: z
                                .array(
                                  z.object({
                                    type: z.string().nullish(),
                                    value: z.string().nullish(),
                                  })
                                )
                                .optional(),
                            })
                          )
                          .optional(),
                      })
                      .optional(),
                  }),
                ])
              ),
          })
          .optional(),
      })
    )
    .optional(),
  chatProfiles: z
    .array(
      z.object({
        id: z.string(),
        plotId: z.string(),
        name: z.string(),
        imageUrl: z.string().nullish(),
        summary: z.string().nullish(),
        description: z.string().nullish(),
        isUsingDefaultName: z.boolean().optional(),
      })
    )
    .optional(),
  // Loose fallback fields consumed via `dExtra` in plot-detail-dialog
  title: z.string().nullish(),
  description: z.string().nullish(),
  synopsis: z.string().nullish(),
  summary: z.string().nullish(),
  hashTags: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  chatCount: z.number().optional(),
  viewCount: z.number().optional(),
})

// ---------------------------------------------------------------------------
// Creator (plot authoring). `looseObject` keeps unknown keys: the editor sends
// the draft back, so nothing it does not edit may be dropped during parsing.
// ---------------------------------------------------------------------------

export const CreatorPlotSchema = z.looseObject({
  id: z.string(),
  status: z.string(),
  isPrivate: z.boolean().nullish(),
  name: z.string().nullish(),
  imageUrl: z.string().nullish(),
  updatedAt: z.string().nullish(),
  releasedAt: z.string().nullish(),
  draft: z.looseObject({}).nullish(),
})

export const CreatorPlotListSchema = z.looseObject({
  plots: z.array(CreatorPlotSchema),
  nextCursor: z.string().nullish(),
})

export const ImageSetResultsSchema = z.looseObject({
  results: z.array(
    z.looseObject({
      type: z.string(),
      imageUrl: z.string().nullish(),
    })
  ),
})

export const ImageUrlResponseSchema = z.looseObject({
  imageUrl: z.string(),
})

export const ProfileImageStyleListSchema = z.looseObject({
  styles: z.array(
    z.looseObject({
      id: z.string(),
      model: z.string(),
      name: z.string(),
      price: z.number(),
      hasDiscount: z.boolean().nullish(),
      thumbnail: z.string(),
      isZetaModel: z.boolean(),
      defaultPrompt: z.string().nullish(),
      negativePrompt: z.string().nullish(),
      enabled: z.boolean().nullish(),
    })
  ),
})

export const ProfileImageJobIdsSchema = z.looseObject({
  jobIds: z.array(z.string()),
})

export const ProfileImageJobStatusSchema = z.looseObject({
  status: z.string(),
  userStatus: z.string().nullish(),
  blockDays: z.number().nullish(),
  profileImageResultId: z.string().nullish(),
})

export const ProfileImageResultSchema = z.looseObject({
  id: z.string(),
  prompt: z.string().nullish(),
  defaultPrompt: z.string().nullish(),
  negativePrompt: z.string().nullish(),
  seed: z.number().nullish(),
  style: z.looseObject({}).nullish(),
  imageUrl: z.string(),
  saved: z.boolean().nullish(),
  createdAt: z.string().nullish(),
  expiredAt: z.string().nullish(),
})

export const ProfileImageHistorySchema = z.looseObject({
  profileImages: z.array(ProfileImageResultSchema),
  nextCursor: z.string().nullish(),
})

export const KeywordTestSchema = z.looseObject({
  hasAbusingKeyword: z.boolean(),
})

export const CheckPlotNameSchema = z.looseObject({
  warnKeywords: z.array(z.string()).nullish(),
})

export const HashtagAutocompleteSchema = z.looseObject({
  hashtags: z.array(
    z.looseObject({
      hashtag: z.string(),
      count: z.number().nullish(),
    })
  ),
})

export const LorebookListSchema = z.looseObject({
  lorebooks: z.array(
    z.looseObject({
      lorebook: z.looseObject({
        id: z.string(),
        title: z.string(),
        description: z.string().nullish(),
      }),
      coverImageUrl: z.string().nullish(),
    })
  ),
  nextCursor: z.string().nullish(),
})

export const LorebookDetailSchema = z.looseObject({
  id: z.string(),
  title: z.string(),
  description: z.string().nullish(),
})

export const PluginCatalogSchema = z.looseObject({
  plugins: z.array(
    z.looseObject({
      id: z.string(),
      displayName: z.string().nullish(),
      paid: z.boolean().nullish(),
    })
  ),
})

export const PlotPluginsSchema = z.looseObject({
  plugins: z.array(
    z.looseObject({
      pluginId: z.string(),
      displayName: z.string().nullish(),
      state: z.string().nullish(),
      paid: z.boolean().nullish(),
      value: z.unknown().nullish(),
      draftValue: z.unknown().nullish(),
      constraints: z.looseObject({}).nullish(),
    })
  ),
})

/** GET /v1/dice-themes → `{items:[{id,name}]}` (LIVE: glm-max PHASE4-RESULTS §2-6). */
export const DiceThemesSchema = z.looseObject({
  items: z.array(
    z.looseObject({
      id: z.string(),
      name: z.string().nullish(),
    })
  ),
})

/** PUT /v1/plots/:id/plugins → `{pluginId, value}`; `value` is the server's stored value (LIVE C2). */
export const PluginPutResponseSchema = z.looseObject({
  pluginId: z.string(),
  value: z.unknown().nullish(),
})

export const PhoneManifestSchema = z.looseObject({
  manifest: z
    .looseObject({
      wallpaperPresets: z
        .array(
          z.looseObject({
            id: z.string(),
            name: z.string().nullish(),
            imageUrl: z.string().nullish(),
          })
        )
        .nullish(),
    })
    .nullish(),
})

export const CommentSettingSchema = z.looseObject({
  windowStatus: z.string(),
})

export const GalleryListSchema = z.looseObject({
  images: z.array(
    z.looseObject({
      imageUrl: z.string(),
      aspectRatio: z.number().nullish(),
    })
  ),
})

export const CreatedRoomSchema = z.looseObject({
  id: z.string(),
})
