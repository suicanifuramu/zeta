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
                    senderId: z.string(),
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
