// src/screens/OtpVerificationScreen.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';

export default function OtpVerificationScreen({ route, navigation }: any) {
    const [code, setCode] = useState('');
    const { donorData } = route.params || {};

    const handleVerify = () => {
        // En démo : n'importe quel code à 6 chiffres (ex: 123456) valide l'étape
        if (code.length === 6) {
            Alert.alert('Succès', 'Numéro de téléphone vérifié !', [
                {
                    text: 'Questionnaire d\'éligibilité',
                    onPress: () => navigation.navigate('Eligibility', { donorData }),
                },
            ]);
        } else {
            Alert.alert('Erreur', 'Veuillez entrer un code à 6 chiffres (ex: 123456)');
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Vérification du numéro</Text>
            <Text style={styles.subtitle}>
                Saisissez le code de confirmation (Code démo : 123456)
            </Text>

            <TextInput
                style={styles.otpInput}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="123456"
                value={code}
                onChangeText={setCode}
            />

            <TouchableOpacity style={styles.button} onPress={handleVerify}>
                <Text style={styles.buttonText}>Confirmer</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
    title: { fontSize: 22, fontWeight: 'bold', color: '#1E293B', marginBottom: 8 },
    subtitle: { fontSize: 14, color: '#64748B', textAlign: 'center', marginBottom: 24 },
    otpInput: { borderWidth: 2, borderColor: '#C62828', borderRadius: 12, padding: 14, fontSize: 24, letterSpacing: 10, textAlign: 'center', width: 180, marginBottom: 20 },
    button: { backgroundColor: '#C62828', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 25 },
    buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});