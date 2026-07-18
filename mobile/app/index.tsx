import { Redirect } from 'expo-router';
import { useAppStore } from '@/store/appStore';

export default function Index() {
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  if (isAuthenticated) {
    return <Redirect href="/(app)/home" />;
  }
  return <Redirect href="/(auth)/login" />;
}
