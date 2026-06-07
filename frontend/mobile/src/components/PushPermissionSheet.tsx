import React, { useState, useEffect } from "react";
import { View, Text, Pressable, Modal, Platform } from "react-native";
import { storage } from "../lib/storage";
import { registerDeviceToken } from "../lib/api";

interface PushPermissionSheetProps {
  visible: boolean;
  onClose: () => void;
}

const STORAGE_KEY_PROMPTED = "push_prompted_v1";

export default function PushPermissionSheet({ visible, onClose }: PushPermissionSheetProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (visible) {
      const alreadyPrompted = storage.getString(STORAGE_KEY_PROMPTED);
      if (!alreadyPrompted) {
        setShow(true);
      }
    } else {
      setShow(false);
    }
  }, [visible]);

  const handleEnable = async () => {
    // Generate a mock push token to represent native FCM/APNs registration
    const mockToken = `fcm-mobile-${Platform.OS}-${Math.random().toString(36).substring(2, 10)}`;
    const platform = Platform.OS === "ios" ? "ios" : "android";

    // Call subscribe endpoint via API client
    await registerDeviceToken(mockToken, platform);

    // Save prompt preference in MMKV storage
    storage.set(STORAGE_KEY_PROMPTED, "granted");
    setShow(false);
    onClose();
  };

  const handleDismiss = () => {
    storage.set(STORAGE_KEY_PROMPTED, "dismissed");
    setShow(false);
    onClose();
  };

  return (
    <Modal
      transparent
      visible={show}
      animationType="slide"
      onRequestClose={handleDismiss}
    >
      <View className="flex-1 justify-end bg-black/40 dark:bg-black/60">
        <View className="bg-white dark:bg-darkSurface rounded-t-3xl p-6 pb-8 space-y-5">
          {/* Header */}
          <View className="space-y-2">
            <View className="bg-emerald-100 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 px-3 py-1 rounded-full self-start">
              <Text className="text-emerald-900 dark:text-emerald-400 text-[9px] font-bold uppercase">Real-Time Alerts</Text>
            </View>
            <Text className="text-lg font-extrabold text-slate-900 dark:text-darkHeading">
              Never Miss an Admission Cutoff
            </Text>
            <Text className="text-xs text-slate-500 dark:text-darkBody leading-relaxed">
              We send push notifications for JoSAA/NEET seat releases, option verification deadlines, and personalized predictions. No PII is collected or tracked.
            </Text>
          </View>

          {/* Action buttons */}
          <View className="space-y-2.5">
            <Pressable
              onPress={handleEnable}
              className="bg-slate-900 active:bg-slate-950 dark:bg-darkBrand dark:active:bg-blue-800 py-3.5 rounded-xl justify-center items-center shadow"
            >
              <Text className="text-white dark:text-darkHeading text-xs font-bold">Enable Notifications</Text>
            </Pressable>

            <Pressable
              onPress={handleDismiss}
              className="bg-slate-55 active:bg-slate-100 dark:bg-darkSurfaceElevated dark:active:bg-darkSurface py-3.5 rounded-xl justify-center items-center border border-slate-200 dark:border-darkBorder"
            >
              <Text className="text-slate-600 dark:text-darkMuted text-xs font-bold">Not Now</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
