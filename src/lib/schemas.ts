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
  description: z.string().optional(),
  isDefault: z.boolean().optional(),
  profileImageUrl: z.string().optional(),
  selected: z.boolean().optional(),
})

// `MyPlotChatProfileResponse` — used by `<MyProfileSheet>` (primary path).
export const MyPlotChatProfileResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  roomId: z.string(),
  plotChatProfileId: z.string().optional(),
  name: z.string(),
  imageUrl: z.string().optional(),
  summary: z.string().optional(),
  description: z.string().optional(),
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
  imageUrl: z.string().optional(),
  shortDescription: z.string().optional(),
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
        imageUrl: z.string().optional(),
        description: z.string().optional(),
      })
    )
    .optional(),
  // PlotDetailResponse-specific fields
  longDescription: z.string().optional(),
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
          content: z.string().optional(),
          text: z.string().optional(),
        })
      ),
      characters: z.array(
        z.object({
          characterId: z.string().optional(),
          description: z.string().optional(),
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
                z.object({
                  senderId: z.string(),
                  content: z.string(),
                  position: z.string().optional(),
                })
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
        imageUrl: z.string().optional(),
        summary: z.string().optional(),
        description: z.string().optional(),
        isUsingDefaultName: z.boolean().optional(),
      })
    )
    .optional(),
  // Loose fallback fields consumed via `dExtra` in plot-detail-dialog
  title: z.string().optional(),
  description: z.string().optional(),
  synopsis: z.string().optional(),
  summary: z.string().optional(),
  hashTags: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  chatCount: z.number().optional(),
  viewCount: z.number().optional(),
})
