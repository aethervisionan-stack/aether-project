import { Redirect } from 'expo-router';

/** Entry redirect → Carteira Fortaleza */
export default function Index() {
  return <Redirect href="/(tabs)/wallet" />;
}
