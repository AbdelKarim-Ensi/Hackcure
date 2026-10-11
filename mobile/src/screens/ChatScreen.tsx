import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    FlatList,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { sendChatMessage, ChatMessageResponse } from '../services/chatService';

interface Message {
    id: string;
    text: string;
    sender: 'user' | 'bot';
    timestamp: Date;
    disclaimer?: string;
    sources?: { id: string; title: string }[];
    needsStaff?: boolean;
}

export const ChatScreen = () => {
    const navigation = useNavigation<any>();

    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            text: 'Bonjour ! Je suis l\'assistant Damm. Posez-moi vos questions sur le don de sang (ex: "Puis-je donner si j\'ai un tatouage ?").',
            sender: 'bot',
            timestamp: new Date(),
            disclaimer: "Je donne des informations générales. L'éligibilité finale est toujours confirmée par un médecin sur place.",
        }
    ]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const sessionId = useRef(`session-${Date.now()}`).current;
    const flatListRef = useRef<FlatList>(null);

    const handleGoHome = () => {
        if (navigation.canGoBack()) {
            navigation.goBack();
        } else {
            navigation.navigate('Home');
        }
    };

    const handleSend = async () => {
        if (!inputText.trim()) return;

        const userMsgText = inputText.trim();
        const userMsg: Message = {
            id: `msg-user-${Date.now()}`,
            text: userMsgText,
            sender: 'user',
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMsg]);
        setInputText('');
        setIsLoading(true);

        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

        try {
            const botResponse: ChatMessageResponse = await sendChatMessage(userMsgText, sessionId);

            const botMsg: Message = {
                id: `msg-bot-${Date.now()}`,
                text: botResponse.answer,
                sender: 'bot',
                timestamp: new Date(),
                disclaimer: botResponse.disclaimer,
                sources: botResponse.sources,
                needsStaff: botResponse.needs_staff,
            };

            setMessages((prev) => [...prev, botMsg]);
        } catch (error) {
            const errorMsg: Message = {
                id: `msg-error-${Date.now()}`,
                text: "Désolé, je n'arrive pas à joindre mes serveurs. Veuillez réessayer.",
                sender: 'bot',
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        }
    };

    const renderMessage = ({ item }: { item: Message }) => {
        const isUser = item.sender === 'user';

        return (
            <View style={[styles.messageWrapper, isUser ? styles.messageWrapperUser : styles.messageWrapperBot]}>
                <View style={[styles.bubble, isUser ? styles.userBubble : styles.botBubble]}>
                    <Text style={[styles.messageText, isUser ? styles.userMessageText : styles.botMessageText]}>
                        {item.text}
                    </Text>

                    {item.needsStaff && (
                        <View style={styles.needsStaffBadge}>
                            <Text style={styles.needsStaffText}>⚠️ Nécessite un avis médical personnalisé</Text>
                        </View>
                    )}

                    {item.sources && item.sources.length > 0 && (
                        <View style={styles.sourcesContainer}>
                            <Text style={styles.sourceLabel}>Sources :</Text>
                            {item.sources.map((s, idx) => (
                                <Text key={idx} style={styles.sourceText}>
                                    {s.title}
                                </Text>
                            ))}
                        </View>
                    )}

                    {item.disclaimer && (
                        <Text style={styles.disclaimerText}>{item.disclaimer}</Text>
                    )}
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            {/* EN-TÊTE ET BOUTON RETOUR SÉCURISÉS */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={handleGoHome}
                    activeOpacity={0.6}
                    hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                >
                    <Text style={styles.backButtonText}>← Accueil</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Assistant Damm</Text>
            </View>

            {/* Disclaimer Global */}
            <View style={styles.globalDisclaimerBanner}>
                <Text style={styles.globalDisclaimerText}>
                    ⚕️ Aucune décision médicale n'est prise ici. Les informations sont générales. En cas de doute, consultez le personnel médical.
                </Text>
            </View>

            <KeyboardAvoidingView
                style={styles.keyboardAvoid}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    keyExtractor={(item) => item.id}
                    renderItem={renderMessage}
                    contentContainerStyle={styles.listContent}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                />

                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.textInput}
                        value={inputText}
                        onChangeText={setInputText}
                        placeholder="Posez votre question..."
                        placeholderTextColor="#94A3B8"
                        multiline
                    />
                    <TouchableOpacity
                        style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
                        onPress={handleSend}
                        disabled={!inputText.trim() || isLoading}
                    >
                        {isLoading ? (
                            <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                            <Text style={styles.sendButtonText}>Envoyer</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
        zIndex: 10,
        elevation: 3,
    },
    backButton: {
        paddingRight: 16,
        paddingVertical: 8,
        paddingLeft: 4,
        justifyContent: 'center',
    },
    backButtonText: {
        color: '#901818',
        fontSize: 16,
        fontWeight: 'bold',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1E293B',
    },

    keyboardAvoid: { flex: 1, backgroundColor: '#F8FAFC' },
    globalDisclaimerBanner: {
        backgroundColor: '#FEF2F2',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#FECACA',
    },
    globalDisclaimerText: { color: '#991B1B', fontSize: 12, textAlign: 'center', fontWeight: '500' },

    listContent: { padding: 16, flexGrow: 1, justifyContent: 'flex-end' },

    messageWrapper: { marginBottom: 16, flexDirection: 'row' },
    messageWrapperUser: { justifyContent: 'flex-end' },
    messageWrapperBot: { justifyContent: 'flex-start' },

    bubble: { maxWidth: '85%', padding: 14, borderRadius: 18 },
    userBubble: { backgroundColor: '#901818', borderBottomRightRadius: 4 },
    botBubble: { backgroundColor: '#FFFFFF', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#E2E8F0' },

    messageText: { fontSize: 15, lineHeight: 22 },
    userMessageText: { color: '#FFFFFF' },
    botMessageText: { color: '#1E293B' },

    disclaimerText: { marginTop: 10, fontSize: 11, color: '#64748B', fontStyle: 'italic', borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 8 },

    sourcesContainer: { marginTop: 8, backgroundColor: '#F8FAFC', padding: 8, borderRadius: 6 },
    sourceLabel: { fontSize: 11, fontWeight: 'bold', color: '#475569', marginBottom: 2 },
    sourceText: { fontSize: 11, color: '#475569' },

    needsStaffBadge: { marginTop: 10, backgroundColor: '#FFFBEB', padding: 8, borderRadius: 6, borderWidth: 1, borderColor: '#FEF08A' },
    needsStaffText: { color: '#B45309', fontSize: 12, fontWeight: 'bold' },

    inputContainer: {
        flexDirection: 'row',
        padding: 12,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#E2E8F0',
        alignItems: 'flex-end',
    },
    textInput: {
        flex: 1,
        backgroundColor: '#F1F5F9',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 12,
        fontSize: 15,
        maxHeight: 100,
        color: '#1E293B',
    },
    sendButton: {
        marginLeft: 10,
        backgroundColor: '#901818',
        borderRadius: 20,
        paddingHorizontal: 18,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 2,
    },
    sendButtonDisabled: { backgroundColor: '#CBD5E1' },
    sendButtonText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 },
});