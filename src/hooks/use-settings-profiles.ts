import { useState } from "react"
import { toast } from "sonner"
import {
  checkUserChatProfileAbuse,
  createUserChatProfile,
  deleteUserChatProfile,
  getUserChatProfiles,
  setDefaultUserChatProfile,
  updateUserChatProfile,
} from "@/lib/api"
import type { UserChatProfile } from "@/lib/types"

export function useSettingsProfiles() {
  const [profiles, setProfiles] = useState<UserChatProfile[]>([])
  const [loadingProfiles, setLoadingProfiles] = useState(false)
  const [editId, setEditId] = useState("")
  const [profileName, setProfileName] = useState("")
  const [profileDesc, setProfileDesc] = useState("")
  const [profileImageUrl, setProfileImageUrl] = useState("")
  const [profileSaving, setProfileSaving] = useState(false)

  const loadProfiles = async () => {
    setLoadingProfiles(true)
    try {
      const data = await getUserChatProfiles(50)
      const list = data.userChatProfiles || data.profiles || []
      setProfiles(Array.isArray(list) ? list : [])
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setLoadingProfiles(false)
    }
  }

  const resetForm = () => {
    setEditId("")
    setProfileName("")
    setProfileDesc("")
    setProfileImageUrl("")
  }

  const handleSaveProfile = async () => {
    if (!profileName.trim()) {
      toast.error("名前を入力してください")
      return
    }
    setProfileSaving(true)
    try {
      if (editId) {
        await updateUserChatProfile(editId, {
          name: profileName,
          description: profileDesc,
          profileImageUrl: profileImageUrl || undefined,
        })
        toast.success("プロフィールを更新しました")
      } else {
        await createUserChatProfile({
          name: profileName,
          description: profileDesc,
          profileImageUrl: profileImageUrl || undefined,
        })
        toast.success("プロフィールを作成しました")
      }
      resetForm()
      await loadProfiles()
    } catch (e: unknown) {
      toast.error(
        `${editId ? "更新" : "作成"}失敗: ${e instanceof Error ? e.message : String(e)}`
      )
    } finally {
      setProfileSaving(false)
    }
  }

  const handleSetDefault = async (id: string) => {
    try {
      await setDefaultUserChatProfile(id)
      toast.success("デフォルトに設定しました")
      await loadProfiles()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`「${name}」を削除しますか?`)) return
    try {
      await deleteUserChatProfile(id)
      toast.success("削除しました")
      await loadProfiles()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

  const handleEdit = (profile: UserChatProfile) => {
    setEditId(profile.id)
    setProfileName(profile.name || "")
    setProfileDesc(profile.description || "")
    setProfileImageUrl(profile.profileImageUrl || "")
  }

  const handleCheckAbuse = async () => {
    try {
      const data = await checkUserChatProfileAbuse({
        name: profileName,
        description: profileDesc,
      })
      toast(data.isAbusing ? "内容チェック: NG" : "内容チェック: OK")
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

  return {
    profiles,
    loadingProfiles,
    loadProfiles,
    editId,
    profileName,
    setProfileName,
    profileDesc,
    setProfileDesc,
    profileImageUrl,
    setProfileImageUrl,
    profileSaving,
    handleSaveProfile,
    handleSetDefault,
    handleDelete,
    handleEdit,
    handleCheckAbuse,
    resetForm,
  }
}
