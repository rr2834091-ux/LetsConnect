import React from 'react';
import { View, Text } from 'react-native';
import { LoginScreen } from '../screens/LoginScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { TeamsScreen } from '../screens/TeamsScreen';
import { MeetingScreen } from '../screens/MeetingScreen';

// Root navigation router component
export const RootNavigator = () => {
  const [currentScreen, setCurrentScreen] = React.useState<'login' | 'chat' | 'teams' | 'meetings'>('login');

  const navigation = {
    replace: (screen: string) => {
      if (screen === 'MainTabs') setCurrentScreen('chat');
      else setCurrentScreen('login');
    },
    navigate: (screen: any) => setCurrentScreen(screen),
  };

  if (currentScreen === 'login') {
    return <LoginScreen navigation={navigation} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#1f1f1f' }}>
      <View style={{ flex: 1 }}>
        {currentScreen === 'chat' && <ChatScreen />}
        {currentScreen === 'teams' && <TeamsScreen />}
        {currentScreen === 'meetings' && <MeetingScreen />}
      </View>

      {/* Mobile Bottom Tab Bar */}
      <View style={{
        height: 56,
        backgroundColor: '#2b2b2b',
        borderTopWidth: 1,
        borderTopColor: '#383838',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
      }}>
        <Text
          onPress={() => setCurrentScreen('chat')}
          style={{ color: currentScreen === 'chat' ? '#7f85f5' : '#adadad', fontWeight: '600', fontSize: 13 }}
        >
          Chat
        </Text>
        <Text
          onPress={() => setCurrentScreen('teams')}
          style={{ color: currentScreen === 'teams' ? '#7f85f5' : '#adadad', fontWeight: '600', fontSize: 13 }}
        >
          Teams
        </Text>
        <Text
          onPress={() => setCurrentScreen('meetings')}
          style={{ color: currentScreen === 'meetings' ? '#7f85f5' : '#adadad', fontWeight: '600', fontSize: 13 }}
        >
          Calendar
        </Text>
        <Text
          onPress={() => setCurrentScreen('login')}
          style={{ color: '#c4314b', fontWeight: '600', fontSize: 13 }}
        >
          Sign Out
        </Text>
      </View>
    </View>
  );
};
