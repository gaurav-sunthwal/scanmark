import { useColorScheme } from '@/hooks/use-color-scheme';
import { authApi } from '@/utils/api';
import { isFirstLaunch, isOfflineMode } from '@/utils/storage';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const [shouldShowLogin, setShouldShowLogin] = useState(false);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Wait for router to be ready
  useEffect(() => {
    if (router && !isReady) {
      // Small delay to ensure router is ready
      const timer = setTimeout(() => {
        setIsReady(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [router, isReady]);

  const checkAuthStatus = async () => {
    try {
      const firstLaunch = await isFirstLaunch();
      
      // If not first launch, check if user is logged in or in offline mode
      if (!firstLaunch) {
        const offline = await isOfflineMode();
        if (offline) {
          // User is in offline mode, skip login
          setShouldShowLogin(false);
          return;
        }
        
        // Check if user has valid auth token
        const isLoggedIn = await authApi.isLoggedIn();
        if (isLoggedIn) {
          // User is logged in, skip login
          setShouldShowLogin(false);
          return;
        }
      }
      
      // Show login for first launch or if not authenticated
      setShouldShowLogin(true);
    } catch (error) {
      console.log('Auth check failed, showing login', error);
      setShouldShowLogin(true);
    }
  };

  // Navigate once ready
  useEffect(() => {
    if (isReady && shouldShowLogin) {
      router.replace('/login');
    }
  }, [isReady, shouldShowLogin, router]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack initialRouteName="index">
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="scanner" options={{ headerShown: false }} />
        <Stack.Screen name="students" options={{ headerShown: false }} />
        <Stack.Screen name="attendance" options={{ headerShown: false }} />
        <Stack.Screen name="export" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
