import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  TextInput,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { submitEligibilityForm, EligibilityAnswers } from '../services/eligibilityService';

export const EligibilityScreen = ({ navigation }: any) => {
  const [age, setAge] = useState<string>('25');
  const [weightKg, setWeightKg] = useState<string>('70');

  const [chronicDisease, setChronicDisease] = useState<boolean>(false);
  const [onTreatment, setOnTreatment] = useState<boolean>(false);
  const [recentTattooOrPiercing, setRecentTattooOrPiercing] = useState<boolean>(false);

  const [hasDonatedBefore, setHasDonatedBefore] = useState<boolean>(false);
  const [lastDonationDate, setLastDonationDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [loading, setLoading] = useState(false);

  // Redirection directe vers la page d'accueil en réinitialisant l'historique
  const goToHomeScreen = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Home' }], // 👈 Remplacez 'Home' par le nom de votre écran d'accueil (ex: 'Main', 'Dashboard')
    });
  };

  const handleSubmit = async () => {
    const numAge = parseInt(age, 10);
    const numWeight = parseFloat(weightKg);

    if (isNaN(numAge) || isNaN(numWeight)) {
      Alert.alert('خطأ', 'الرجاء إدخال عمر ووزن صحيحين');
      return;
    }

    setLoading(true);

    const answers: EligibilityAnswers = {
      age: numAge,
      weightKg: numWeight,
      lastDonationDate: hasDonatedBefore ? lastDonationDate.toISOString().split('T')[0] : undefined,
      chronicDisease,
      onTreatment,
      hepatitisOrHivHistory: false,
      recentSurgery: false,
      recentTattooOrPiercing,
      recentTransfusion: false,
      riskAreaTravel: false,
      recentVaccination: false,
      recentFeverOrInfection: false,
      pregnantOrBreastfeeding: false,
      consent: true,
    };

    try {
      const evaluation = await submitEligibilityForm(answers);

      if (evaluation.isEligible) {
        Alert.alert(
          'نتيجة الاختبار 🩸',
          'أنت مؤهل للتبرع بالدم !',
          [{ text: 'موافق', onPress: goToHomeScreen }]
        );
      } else {
        const reasonsText = evaluation.reasons.map((r) => `• ${r}`).join('\n');
        Alert.alert(
          'غير مؤهل للتبرع حالياً ⚠️',
          `أسباب عدم الأهلية:\n\n${reasonsText}`,
          [{ text: 'حسناً', onPress: goToHomeScreen }]
        );
      }
    } catch (error: any) {
      Alert.alert('خطأ', error.message || 'حدث خطأ أثناء الاتصال بالسيرفر');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>

        <View style={styles.header}>
          <Text style={styles.headerTitle}>استمارة التبرع بالدم 🩸</Text>
          <Text style={styles.headerSubtitle}>إختبار الأهلية السريع للتبرع</Text>
        </View>

        {/* Âge et Poids */}
        <View style={styles.card}>
          <Text style={styles.questionText}>المعلومات الأساسية</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>العمر (سنة):</Text>
            <TextInput
              style={styles.textInput}
              keyboardType="numeric"
              value={age}
              onChangeText={setAge}
              maxLength={3}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>الوزن (كغ):</Text>
            <TextInput
              style={styles.textInput}
              keyboardType="numeric"
              value={weightKg}
              onChangeText={setWeightKg}
              maxLength={3}
            />
          </View>
        </View>

        {/* Questions Médicales */}
        <View style={styles.card}>
          <Text style={styles.questionText}>1. هل تعاني من أي أمراض مزمنة؟</Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity style={[styles.optionBtn, chronicDisease && styles.optionBtnSelected]} onPress={() => setChronicDisease(true)}>
              <Text style={[styles.optionText, chronicDisease && styles.optionTextSelected]}>نعم</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.optionBtn, !chronicDisease && styles.optionBtnSelected]} onPress={() => setChronicDisease(false)}>
              <Text style={[styles.optionText, !chronicDisease && styles.optionTextSelected]}>لا</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.questionText}>2. هل تتناول أدوية أو مضادات حيوية حالياً؟</Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity style={[styles.optionBtn, onTreatment && styles.optionBtnSelected]} onPress={() => setOnTreatment(true)}>
              <Text style={[styles.optionText, onTreatment && styles.optionTextSelected]}>نعم</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.optionBtn, !onTreatment && styles.optionBtnSelected]} onPress={() => setOnTreatment(false)}>
              <Text style={[styles.optionText, !onTreatment && styles.optionTextSelected]}>لا</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.questionText}>3. هل قمت بعمل وشم (Tattoo) خلال الـ 4 أشهر الأخيرة؟</Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity style={[styles.optionBtn, recentTattooOrPiercing && styles.optionBtnSelected]} onPress={() => setRecentTattooOrPiercing(true)}>
              <Text style={[styles.optionText, recentTattooOrPiercing && styles.optionTextSelected]}>نعم</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.optionBtn, !recentTattooOrPiercing && styles.optionBtnSelected]} onPress={() => setRecentTattooOrPiercing(false)}>
              <Text style={[styles.optionText, !recentTattooOrPiercing && styles.optionTextSelected]}>لا</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Date du dernier don */}
        <View style={styles.card}>
          <Text style={styles.questionText}>4. هل تبرعت بالدم من قبل؟</Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity style={[styles.optionBtn, hasDonatedBefore && styles.optionBtnSelected]} onPress={() => setHasDonatedBefore(true)}>
              <Text style={[styles.optionText, hasDonatedBefore && styles.optionTextSelected]}>نعم</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.optionBtn, !hasDonatedBefore && styles.optionBtnSelected]} onPress={() => setHasDonatedBefore(false)}>
              <Text style={[styles.optionText, !hasDonatedBefore && styles.optionTextSelected]}>لا</Text>
            </TouchableOpacity>
          </View>

          {hasDonatedBefore && (
            <View style={styles.dateContainer}>
              <Text style={styles.dateLabel}>تاريخ آخر تبرع:</Text>
              <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowDatePicker(true)}>
                <Text style={styles.datePickerText}>{lastDonationDate.toISOString().split('T')[0]}</Text>
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={lastDonationDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  maximumDate={new Date()}
                  onChange={(e, selectedDate) => {
                    setShowDatePicker(false);
                    if (selectedDate) setLastDonationDate(selectedDate);
                  }}
                />
              )}
            </View>
          )}
        </View>

        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitBtnText}>تأكيد وإرسال الاستمارة 🩸</Text>}
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F9F9' },
  scrollContent: { padding: 20 },
  header: { backgroundColor: '#C62828', padding: 20, borderRadius: 12, alignItems: 'center', marginBottom: 20 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 6 },
  headerSubtitle: { fontSize: 14, color: '#FFEBEE' },
  card: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 10, marginBottom: 16, borderWidth: 1, borderColor: '#E0E0E0', elevation: 2 },
  questionText: { fontSize: 16, fontWeight: '600', color: '#212121', textAlign: 'right', marginBottom: 12 },
  inputContainer: { marginVertical: 8, alignItems: 'flex-end' },
  inputLabel: { fontSize: 14, color: '#424242', marginBottom: 4, fontWeight: '500' },
  textInput: { borderWidth: 1, borderColor: '#BDBDBD', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, width: '100%', textAlign: 'right', fontSize: 16 },
  buttonRow: { flexDirection: 'row-reverse', justifyContent: 'space-between' },
  optionBtn: { flex: 0.48, paddingVertical: 10, borderWidth: 1, borderColor: '#C62828', borderRadius: 8, alignItems: 'center' },
  optionBtnSelected: { backgroundColor: '#C62828' },
  optionText: { fontSize: 15, fontWeight: 'bold', color: '#C62828' },
  optionTextSelected: { color: '#FFFFFF' },
  dateContainer: { marginTop: 15, alignItems: 'flex-end' },
  dateLabel: { fontSize: 14, color: '#616161', marginBottom: 6 },
  datePickerBtn: { backgroundColor: '#FFEBEE', padding: 10, borderRadius: 8, width: '100%', alignItems: 'center' },
  datePickerText: { fontSize: 16, color: '#C62828', fontWeight: 'bold' },
  submitBtn: { backgroundColor: '#C62828', paddingVertical: 15, borderRadius: 10, alignItems: 'center', marginTop: 10, elevation: 3 },
  submitBtnText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
});