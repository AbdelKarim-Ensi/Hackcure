import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TextInput,
    TouchableOpacity,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    ImageBackground,
} from 'react-native';

type BloodGroup = 'A' | 'B' | 'AB' | 'O';
type RhFactor = '+' | '-';

const BLOOD_GROUPS: BloodGroup[] = ['A', 'B', 'AB', 'O'];
const RH_FACTORS: RhFactor[] = ['+', '-'];

// --- Composant interactif Poche de Sang ---
const BloodBagIllustration = ({ bloodType }: { bloodType: string }) => {
    return (
        <View style={bagStyles.container}>
            <View style={bagStyles.topHook} />
            <View style={bagStyles.bagBody}>
                <View style={bagStyles.bloodLiquid} />
                <View style={bagStyles.labelCard}>
                    <Text style={bagStyles.labelText}>{bloodType}</Text>
                </View>
            </View>
            <View style={bagStyles.bottomTube} />
        </View>
    );
};

export default function AuthScreen() {
    const [isLogin, setIsLogin] = useState(false);

    // Form states
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');

    // États du groupe sanguin
    const [selectedGroup, setSelectedGroup] = useState<BloodGroup>('B');
    const [selectedRh, setSelectedRh] = useState<RhFactor>('+');
    const [unknownBloodType, setUnknownBloodType] = useState(false);

    // Valeur affichée et envoyée
    const fullBloodType = unknownBloodType ? '?' : `${selectedGroup}${selectedRh}`;
    const bloodTypeToSubmit = unknownBloodType ? 'Inconnu' : `${selectedGroup}${selectedRh}`;

    const handleSubmit = () => {
        if (isLogin) {
            console.log('Connexion Damm :', { email, password });
        } else {
            console.log('Inscription Damm :', {
                fullName,
                email,
                password,
                bloodType: bloodTypeToSubmit,
            });
        }
    };

    return (
        <ImageBackground
            source={require('../assets/damm_pattern.jpg')}
            style={styles.backgroundImage}
            resizeMode="repeat"
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.container}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContainer}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Carte principale */}
                    <View style={styles.cardContainer}>
                        {/* En-tête */}
                        <View style={styles.header}>
                            <Text style={styles.brandTitle}>Damm</Text>
                            <Text style={styles.brandSubtitle}>
                                {isLogin ? 'Bon retour parmi nous' : 'Chaque goutte compte'}
                            </Text>
                        </View>

                        {/* Commutateur Connexion / Inscription */}
                        <View style={styles.toggleContainer}>
                            <TouchableOpacity
                                style={[styles.toggleButton, isLogin && styles.toggleActive]}
                                onPress={() => setIsLogin(true)}
                            >
                                <Text style={[styles.toggleText, isLogin && styles.toggleTextActive]}>
                                    Connexion
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.toggleButton, !isLogin && styles.toggleActive]}
                                onPress={() => setIsLogin(false)}
                            >
                                <Text style={[styles.toggleText, !isLogin && styles.toggleTextActive]}>
                                    Inscription
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Formulaire d'inscription */}
                        {!isLogin && (
                            <>
                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Nom complet</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Ex: Myriam Ben Ali"
                                        placeholderTextColor="#888"
                                        value={fullName}
                                        onChangeText={setFullName}
                                    />
                                </View>

                                <View style={styles.bloodSection}>
                                    <Text style={styles.sectionTitle}>Votre groupe sanguin</Text>

                                    {/* Poche de sang */}
                                    <BloodBagIllustration bloodType={fullBloodType} />

                                    {/* Option "Je ne sais pas" */}
                                    <TouchableOpacity
                                        style={styles.unknownOptionRow}
                                        onPress={() => setUnknownBloodType(!unknownBloodType)}
                                        activeOpacity={0.7}
                                    >
                                        <View
                                            style={[
                                                styles.checkbox,
                                                unknownBloodType && styles.checkboxActive,
                                            ]}
                                        >
                                            {unknownBloodType && <Text style={styles.checkmark}>✓</Text>}
                                        </View>
                                        <Text style={styles.unknownOptionText}>
                                            Je ne connais pas mon groupe sanguin
                                        </Text>
                                    </TouchableOpacity>

                                    {/* Sélecteurs désactivés si groupe inconnu */}
                                    {!unknownBloodType && (
                                        <>
                                            {/* Sélecteur A, B, AB, O */}
                                            <View style={styles.selectorRow}>
                                                {BLOOD_GROUPS.map((group) => {
                                                    const isSelected = selectedGroup === group;
                                                    return (
                                                        <TouchableOpacity
                                                            key={group}
                                                            style={[
                                                                styles.selectorButton,
                                                                isSelected && styles.selectorButtonActive,
                                                            ]}
                                                            onPress={() => setSelectedGroup(group)}
                                                        >
                                                            <Text
                                                                style={[
                                                                    styles.selectorText,
                                                                    isSelected && styles.selectorTextActive,
                                                                ]}
                                                            >
                                                                {group}
                                                            </Text>
                                                        </TouchableOpacity>
                                                    );
                                                })}
                                            </View>

                                            {/* Sélecteur + / - */}
                                            <View style={styles.selectorRow}>
                                                {RH_FACTORS.map((rh) => {
                                                    const isSelected = selectedRh === rh;
                                                    return (
                                                        <TouchableOpacity
                                                            key={rh}
                                                            style={[
                                                                styles.selectorButton,
                                                                isSelected && styles.selectorButtonActive,
                                                            ]}
                                                            onPress={() => setSelectedRh(rh)}
                                                        >
                                                            <Text
                                                                style={[
                                                                    styles.selectorText,
                                                                    isSelected && styles.selectorTextActive,
                                                                ]}
                                                            >
                                                                {rh}
                                                            </Text>
                                                        </TouchableOpacity>
                                                    );
                                                })}
                                            </View>
                                        </>
                                    )}
                                </View>
                            </>
                        )}

                        {/* Champs Email & Mot de passe */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Adresse Email</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="exemple@mail.com"
                                placeholderTextColor="#888"
                                keyboardType="email-address"
                                autoCapitalize="none"
                                value={email}
                                onChangeText={setEmail}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Mot de passe</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="••••••••"
                                placeholderTextColor="#888"
                                secureTextEntry
                                value={password}
                                onChangeText={setPassword}
                            />
                        </View>

                        {isLogin && (
                            <TouchableOpacity style={styles.forgotPassButton}>
                                <Text style={styles.forgotPassText}>Mot de passe oublié ?</Text>
                            </TouchableOpacity>
                        )}

                        {/* Bouton de soumission */}
                        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
                            <Text style={styles.submitButtonText}>
                                {isLogin ? 'Se Connecter' : "S'inscrire"}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </ImageBackground>
    );
}

// Styles de l'illustration
const bagStyles = StyleSheet.create({
    container: {
        alignItems: 'center',
        marginVertical: 10,
    },
    topHook: {
        width: 28,
        height: 14,
        borderTopLeftRadius: 8,
        borderTopRightRadius: 8,
        borderWidth: 3,
        borderColor: '#B0BEC5',
        borderBottomWidth: 0,
    },
    bagBody: {
        width: 110,
        height: 135,
        borderRadius: 20,
        borderWidth: 3,
        borderColor: '#B0BEC5',
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        position: 'relative',
    },
    bloodLiquid: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '65%',
        backgroundColor: '#C62828',
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 16,
    },
    labelCard: {
        width: 62,
        height: 52,
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 3,
        elevation: 3,
        zIndex: 2,
    },
    labelText: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#1E293B',
    },
    bottomTube: {
        width: 14,
        height: 10,
        backgroundColor: '#B0BEC5',
        borderBottomLeftRadius: 4,
        borderBottomRightRadius: 4,
    },
});

// Styles de l'application
const styles = StyleSheet.create({
    backgroundImage: {
        flex: 1,
        width: '100%',
        height: '100%',
    },
    container: {
        flex: 1,
    },
    scrollContainer: {
        flexGrow: 1,
        paddingHorizontal: 18,
        paddingVertical: 24,
        justifyContent: 'center',
    },
    cardContainer: {
        backgroundColor: 'rgba(255, 255, 255, 0.94)',
        borderRadius: 24,
        paddingHorizontal: 20,
        paddingVertical: 22,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 6,
    },
    header: {
        alignItems: 'center',
        marginBottom: 14,
    },
    brandTitle: {
        fontSize: 34,
        fontWeight: '900',
        color: '#C62828',
        letterSpacing: 1,
    },
    brandSubtitle: {
        fontSize: 14,
        color: '#64748B',
        marginTop: 2,
    },
    toggleContainer: {
        flexDirection: 'row',
        backgroundColor: '#E2E8F0',
        borderRadius: 12,
        padding: 4,
        marginBottom: 16,
    },
    toggleButton: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 8,
    },
    toggleActive: {
        backgroundColor: '#1E293B',
    },
    toggleText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748B',
    },
    toggleTextActive: {
        color: '#FFFFFF',
    },
    inputGroup: {
        marginBottom: 12,
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        color: '#334155',
        marginBottom: 6,
    },
    input: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#CBD5E1',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 11,
        fontSize: 15,
        color: '#0F172A',
    },
    bloodSection: {
        marginVertical: 6,
        alignItems: 'center',
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1E293B',
        alignSelf: 'flex-start',
        marginBottom: 4,
    },
    unknownOptionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 10,
        alignSelf: 'flex-start',
    },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 5,
        borderWidth: 2,
        borderColor: '#64748B',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
        backgroundColor: '#FFFFFF',
    },
    checkboxActive: {
        backgroundColor: '#C62828',
        borderColor: '#C62828',
    },
    checkmark: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: 'bold',
    },
    unknownOptionText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#475569',
    },
    selectorRow: {
        flexDirection: 'row',
        backgroundColor: '#F1F5F9',
        borderRadius: 10,
        padding: 3,
        marginVertical: 4,
        width: '100%',
    },
    selectorButton: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 7,
    },
    selectorButtonActive: {
        backgroundColor: '#C62828',
    },
    selectorText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#64748B',
    },
    selectorTextActive: {
        color: '#FFFFFF',
    },
    forgotPassButton: {
        alignSelf: 'flex-end',
        marginBottom: 14,
    },
    forgotPassText: {
        fontSize: 13,
        color: '#C62828',
        fontWeight: '600',
    },
    submitButton: {
        backgroundColor: '#C62828',
        paddingVertical: 14,
        borderRadius: 25,
        alignItems: 'center',
        marginTop: 10,
        shadowColor: '#C62828',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 4,
    },
    submitButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
});