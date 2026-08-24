import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Provider as PaperProvider } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform } from 'react-native';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  
  // Calcular el padding inferior basado en el área segura del dispositivo
  // Esto ajusta automáticamente para dispositivos con barra de gestos o botones virtuales
  const bottomPadding = Platform.select({
    ios: Math.max(insets.bottom, 8),
    android: Math.max(insets.bottom, 8),
    default: 8,
  });

  return (
    <PaperProvider>
      <Tabs
        screenOptions={{
          lazy: true, // ⚡ Perf: cargar cada tab solo cuando se visita por primera vez
          tabBarActiveTintColor: '#6200ee',
          tabBarInactiveTintColor: '#666',
          tabBarStyle: {
            height: 56 + bottomPadding,
            paddingBottom: bottomPadding,
            paddingTop: 6,
            backgroundColor: '#ffffff',
            borderTopWidth: 1,
            borderTopColor: '#e0e0e0',
            elevation: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
          },
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '500',
            marginTop: 2,
          },
          tabBarIconStyle: {
            marginTop: 2,
          },
          headerStyle: {
            backgroundColor: '#6200ee',
            elevation: 4,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 4,
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
            fontSize: 18,
          },
        }}
      >
        <Tabs.Screen
          name="calculator"
          options={{
            title: 'Calculadora',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="calculator" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="flows"
          options={{
            title: 'Flujos',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="sitemap" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="products"
          options={{
            title: 'Productos',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="package-variant" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: 'Historial',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="history" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="quotes"
          options={{
            title: 'Cotizar',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="receipt" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="quotes-client"
          options={{
            title: 'Cotizar C',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="account-cash" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="import-export"
          options={{
            title: 'Importar',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="swap-horizontal" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="index"
          options={{
            href: null,
          }}
        />
      </Tabs>
    </PaperProvider>
  );
}
