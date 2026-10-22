import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  SafeAreaView
} from 'react-native';
import { mobileApi } from '../services/api';

export const LoginScreen = ({ navigation }: any) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [context, setContext] = useState<'work' | 'personal'>('work');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Required', 'Please enter email and password.');
      return;
    }

    setLoading(true);
    try {
      const resp = await mobileApi.post<any>('/api/v1/auth/login/', {
        email: email.trim(),
        password,
        context,
      });

      mobileApi.setToken(resp.token);
      if (resp.active_organization) {
        mobileApi.setActiveOrgId(resp.active_organization.id);
      }

      navigation.replace('MainTabs', { user: resp.user, activeOrg: resp.active_organization });
    } catch (err: any) {
      Alert.alert('Sign In Failed', err.message || 'Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Branding */}
        <View style={styles.brandBox}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>LC</Text>
          </View>
          <Text style={styles.appName}>LetsConnect</Text>
          <Text style={styles.tagline}>Empower Your Future With Expertise</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to your collaboration workspace</Text>

          {/* Context Switcher */}
          <View style={styles.contextSwitch}>
            <TouchableOpacity
              style={[styles.contextBtn, context === 'work' && styles.contextBtnActive]}
              onPress={() => setContext('work')}
            >
              <Text style={[styles.contextText, context === 'work' && styles.contextTextActive]}>Work</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.contextBtn, context === 'personal' && styles.contextBtnActive]}
              onPress={() => setContext('personal')}
            >
              <Text style={[styles.contextText, context === 'personal' && styles.contextTextActive]}>Personal</Text>
            </TouchableOpacity>
          </View>

          {/* Form */}
          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={styles.input}
            placeholder={context === 'work' ? 'employee@company.com' : 'personal@gmail.com'}
            placeholderTextColor="#8a8a8a"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#8a8a8a"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity
            style={styles.signInBtn}
            onPress={handleSignIn}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.signInText}>Sign In</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f8',
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  brandBox: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoBadge: {
    width: 48,
    height: 48,
    backgroundColor: '#5b5fc7',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  logoText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 20,
  },
  appName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1f1f1f',
  },
  tagline: {
    fontSize: 12,
    color: '#616161',
    marginTop: 2,
    fontWeight: '500',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#242424',
  },
  subtitle: {
    fontSize: 13,
    color: '#616161',
    marginBottom: 16,
  },
  contextSwitch: {
    flexDirection: 'row',
    backgroundColor: '#f0f1f5',
    borderRadius: 6,
    padding: 3,
    marginBottom: 16,
  },
  contextBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 4,
  },
  contextBtnActive: {
    backgroundColor: '#fff',
    elevation: 1,
  },
  contextText: {
    fontSize: 12,
    color: '#616161',
    fontWeight: '600',
  },
  contextTextActive: {
    color: '#5b5fc7',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3b3b3b',
    marginBottom: 4,
  },
  input: {
    height: 40,
    backgroundColor: '#f9f9fb',
    borderWidth: 1,
    borderColor: '#d1d1d6',
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#242424',
    marginBottom: 12,
  },
  signInBtn: {
    backgroundColor: '#5b5fc7',
    height: 42,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  signInText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
});
