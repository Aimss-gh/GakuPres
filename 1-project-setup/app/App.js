import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold } from '@expo-google-fonts/inter';
import { CaveatBrush_400Regular } from '@expo-google-fonts/caveat-brush';
import { PixelifySans_700Bold } from '@expo-google-fonts/pixelify-sans';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { C } from './src/theme';
import Login from './src/screens/Login';
import Register from './src/screens/Register';
import Dashboard from './src/screens/Dashboard';
import CreateClass from './src/screens/CreateClass';
import ClassDetail from './src/screens/ClassDetail';
import QRScan from './src/screens/QRScan';
import Settings from './src/screens/Settings';
import History from './src/screens/History';
import ForgotPassword from './src/screens/ForgotPassword';
import Feedback from './src/screens/Feedback';
import VerifyEmail from './src/screens/VerifyEmail';

const Stack = createNativeStackNavigator();

// Logged in -> app screens (email not verified yet -> only the "check your email" screen). Logged out -> login/register.
function Root() {
  const { user, loading } = useAuth();
  if (loading) return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: C.cream }}><ActivityIndicator color={C.orange} size="large" /></View>;
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.cream } }}>
      {user && user.verified === false ? (
        <Stack.Screen name="VerifyEmail" component={VerifyEmail} />
      ) : user ? (
        <>
          <Stack.Screen name="Dashboard" component={Dashboard} />
          <Stack.Screen name="CreateClass" component={CreateClass} />
          <Stack.Screen name="EditClass" component={CreateClass} />{/* same form; route.params.id = the class */}
          <Stack.Screen name="ClassDetail" component={ClassDetail} />
          <Stack.Screen name="QRScan" component={QRScan} options={{ animation: 'fade' }} />
          <Stack.Screen name="Settings" component={Settings} />
          <Stack.Screen name="History" component={History} />
          <Stack.Screen name="Feedback" component={Feedback} />
        </>
      ) : (
        <>
          <Stack.Screen name="Login" component={Login} />
          <Stack.Screen name="Register" component={Register} />
          <Stack.Screen name="ForgotPassword" component={ForgotPassword} />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  // FONTS are loaded here. To add/replace a font: import it above, add it to this list, then name it in src/theme.js (F).
  const [loaded, error] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold, CaveatBrush_400Regular, PixelifySans_700Bold });
  if (!loaded && !error) return <View style={{ flex: 1, backgroundColor: C.cream }} />;
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider>
        <NavigationContainer>
          <Root />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}