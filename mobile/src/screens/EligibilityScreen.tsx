import React, { useState, useRef, useEffect } from 'react';
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
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { submitEligibilityForm, EligibilityAnswers } from '../services/eligibilityService';

// ------------------------------------------------------------------
// 💓 COMPOSANT ECG ANIMÉ FAÇON MONITEUR DE SANTÉ (BALAYAGE LUMINEUX)
// ------------------------------------------------------------------
const ECG_PERIOD = 200;   // Largeur d'un battement
const ECG_HEIGHT = 44;    // Hauteur de la zone
const SWEEP_WIDTH = 150;  // Largeur du faisceau lumineux qui défile

const ECG_POINTS: [number, number][] = [
  [0, 22], [40, 22], [46, 18], [52, 22], [70, 22],
  [76, 27], [83, 4], [91, 40], [97, 22], [120, 22],
  [130, 16], [140, 22], [200, 22],
];

const EcgPeriod = ({ color, thickness }: { color: string; thickness: number }) => (
  <View style={{ width: ECG_PERIOD, height: ECG_HEIGHT }}>
    {ECG_POINTS.slice(0, -1).map(([x1, y1], i) => {
      const [x2, y2] = ECG_POINTS[i + 1];
      const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
      const angle = Math.atan2(y2 - y1, x2 - x1);
      return (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: (x1 + x2) / 2 - len / 2,
            top: (y1 + y2) / 2 - thickness / 2,
            width: len,
            height: thickness,
            borderRadius: thickness / 2,
            backgroundColor: color,
            transform: [{ rotate: `${angle}rad` }],
          }}
        />
      );
    })}
  </View>
);

const EcgStrip = ({ color, thickness, repeats }: { color: string; thickness: number; repeats: number }) => (
  <View style={{ flexDirection: 'row' }}>
    {Array.from({ length: repeats }).map((_, i) => (
      <EcgPeriod key={i} color={color} thickness={thickness} />
    ))}
  </View>
);

const AnimatedHeartbeat = () => {
  const screenWidth = Dimensions.get('window').width;
  const repeats = Math.ceil(screenWidth / ECG_PERIOD) + 1;

  const sweepX = useRef(new Animated.Value(-SWEEP_WIDTH)).current;
  const innerX = useRef(Animated.multiply(sweepX, -1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sweepX, {
          toValue: screenWidth,
          duration: 2400,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.delay(300),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [sweepX, screenWidth]);

  return (
    <View style={heartbeatStyles.container}>
      <EcgStrip color="rgba(255, 255, 255, 0.28)" thickness={1.5} repeats={repeats} />
      <Animated.View
        pointerEvents="none"
        style={[heartbeatStyles.sweepWindow, { transform: [{ translateX: sweepX }] }]}
      >
        <Animated.View style={[heartbeatStyles.sweepInner, { transform: [{ translateX: innerX }] }]}>
          <EcgStrip color="#FFFFFF" thickness={2.5} repeats={repeats} />
        </Animated.View>
      </Animated.View>
    </View>
  );
};

export const EligibilityScreen = ({ navigation, route }: any) => {
  const [age, setAge] = useState<string>('25');
  const [weightKg, setWeightKg] = useState<string>('70');

  const [chronicDisease, setChronicDisease] = useState<boolean>(false);
  const [onTreatment, setOnTreatment] = useState<boolean>(false);
  const [recentTattooOrPiercing, setRecentTattooOrPiercing] = useState<boolean>(false);

  const [hasDonatedBefore, setHasDonatedBefore] = useState<boolean>(false);
  const [lastDonationDate, setLastDonationDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [loading, setLoading] = useState(false);

  const goToHomeScreen = () => {
    const token = route?.params?.accessToken;
    const currentUser = route?.params?.user;

    navigation.reset({
      index: 0,
      routes: [
        {
          name: 'Home',
          params: {
            accessToken: token,
            user: currentUser,
          },
        },
      ],
    });
  };

  const handleSubmit = async () => {
    const numAge = parseInt(age, 10);
    const numWeight = parseFloat(weightKg);

    if (isNaN(numAge) || isNaN(numWeight)) {
      Alert.alert('خطأ', 'الرجاء إدخال عمر ووزن صحيحين');
      return;
    }

    const token = route?.params?.accessToken;
    const userId = route?.params?.user?.id || route?.params?.user?.userId;

    if (!token || !userId) {
      Alert.alert('خطأ', 'جلسة غير صالحة، يرجى إعادة التسجيل');
      navigation.navigate('Auth');
      return;
    }

    setLoading(true);

    const formattedLastDate = (hasDonatedBefore && lastDonationDate instanceof Date)
      ? lastDonationDate.toISOString().split('T')[0]
      : undefined;

    const answers: EligibilityAnswers = {
      age: numAge,
      weightKg: numWeight,
      lastDonationDate: formattedLastDate,
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
      const evaluation = await submitEligibilityForm(answers, token, userId);

      if (evaluation.isEligible) {
        Alert.alert(
          'نتيجة الاختبار 🩸',
          'أنت مؤهل للتبرع بالدم !',
          [{ text: 'موافق', onPress: goToHomeScreen }]
        );
      } else {
        const reasonsList = Array.isArray(evaluation.reasons) ? evaluation.reasons : [];
        const reasonsText = reasonsList.length > 0
          ? reasonsList.map((r) => `• ${r || ''}`).join('\n')
          : 'غير مؤهل للتبرع حالياً.';

        Alert.alert(
          'غير مؤهل للتبرع حالياً ⚠️',
          `أسباب عدم الأهلية:\n\n${reasonsText}`,
          [{ text: 'حسناً', onPress: goToHomeScreen }]
        );
      }
    } catch (error: any) {
      Alert.alert('خطأ', String(error?.message || 'حدث خطأ أثناء الاتصال بالسيرفر'));
    } finally {
      setLoading(false);
    }
  };

  const formattedDateString = lastDonationDate instanceof Date
    ? lastDonationDate.toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* EN-TÊTE CHARLES NICOLLE AVEC ECG ANIMÉ */}
        <View style={headerStyles.headerBanner}>
          <View style={headerStyles.topRow}>
            <View style={headerStyles.brandContainer}>
              <Text style={headerStyles.dropIcon}>🩸</Text>
              <Text style={headerStyles.brandTitle}>Damm</Text>
              <Text style={headerStyles.arabicTitle}>دمّ</Text>
            </View>
            <View style={headerStyles.liveBadge}>
              <View style={headerStyles.liveDot} />
              <Text style={headerStyles.liveText}>En direct</Text>
            </View>
          </View>

          <Text style={headerStyles.brandSubtitle}>
            Chaque goutte compte. • استمارة الأهلية
          </Text>

          <AnimatedHeartbeat />
        </View>

        <View style={styles.formContent}>

          {/* Informations de base */}
          <View style={styles.card}>
            <Text style={styles.cardHeaderTitle}>المعلومات الأساسية</Text>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>العمر (سنة):</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="numeric"
                value={age ?? ''}
                onChangeText={(val) => setAge(val ?? '')}
                maxLength={3}
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>الوزن (كغ):</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="numeric"
                value={weightKg ?? ''}
                onChangeText={(val) => setWeightKg(val ?? '')}
                maxLength={3}
                placeholderTextColor="#94A3B8"
              />
            </View>
          </View>

          {/* Question 1 */}
          <View style={styles.card}>
            <Text style={styles.questionText}>1. هل تعاني من أي أمراض مزمنة؟</Text>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.optionBtn, chronicDisease && styles.optionBtnSelected]}
                onPress={() => setChronicDisease(true)}
              >
                <Text style={[styles.optionText, chronicDisease && styles.optionTextSelected]}>نعم</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.optionBtn, !chronicDisease && styles.optionBtnSelected]}
                onPress={() => setChronicDisease(false)}
              >
                <Text style={[styles.optionText, !chronicDisease && styles.optionTextSelected]}>لا</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Question 2 */}
          <View style={styles.card}>
            <Text style={styles.questionText}>2. هل تتناول أدوية أو مضادات حيوية حالياً؟</Text>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.optionBtn, onTreatment && styles.optionBtnSelected]}
                onPress={() => setOnTreatment(true)}
              >
                <Text style={[styles.optionText, onTreatment && styles.optionTextSelected]}>نعم</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.optionBtn, !onTreatment && styles.optionBtnSelected]}
                onPress={() => setOnTreatment(false)}
              >
                <Text style={[styles.optionText, !onTreatment && styles.optionTextSelected]}>لا</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Question 3 */}
          <View style={styles.card}>
            <Text style={styles.questionText}>3. هل قمت بعمل وشم (Tattoo) خلال الـ 4 أشهر الأخيرة؟</Text>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.optionBtn, recentTattooOrPiercing && styles.optionBtnSelected]}
                onPress={() => setRecentTattooOrPiercing(true)}
              >
                <Text style={[styles.optionText, recentTattooOrPiercing && styles.optionTextSelected]}>نعم</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.optionBtn, !recentTattooOrPiercing && styles.optionBtnSelected]}
                onPress={() => setRecentTattooOrPiercing(false)}
              >
                <Text style={[styles.optionText, !recentTattooOrPiercing && styles.optionTextSelected]}>لا</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Question 4 - Date du dernier don */}
          <View style={styles.card}>
            <Text style={styles.questionText}>4. هل تبرعت بالدم من قبل؟</Text>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.optionBtn, hasDonatedBefore && styles.optionBtnSelected]}
                onPress={() => setHasDonatedBefore(true)}
              >
                <Text style={[styles.optionText, hasDonatedBefore && styles.optionTextSelected]}>نعم</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.optionBtn, !hasDonatedBefore && styles.optionBtnSelected]}
                onPress={() => setHasDonatedBefore(false)}
              >
                <Text style={[styles.optionText, !hasDonatedBefore && styles.optionTextSelected]}>لا</Text>
              </TouchableOpacity>
            </View>

            {hasDonatedBefore && (
              <View style={styles.dateContainer}>
                <Text style={styles.dateLabel}>تاريخ آخر تبرع:</Text>
                <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowDatePicker(true)}>
                  <Text style={styles.datePickerText}>{formattedDateString}</Text>
                </TouchableOpacity>
                {showDatePicker && (
                  <DateTimePicker
                    value={lastDonationDate || new Date()}
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

          {/* Bouton de Soumission */}
          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitBtnText}>تأكيد وإرسال الاستمارة 🩸</Text>
            )}
          </TouchableOpacity>

        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

// --- STYLES HEARTBEAT ECG ---
const heartbeatStyles = StyleSheet.create({
  container: {
    height: ECG_HEIGHT,
    marginTop: 12,
    marginHorizontal: -20,
    overflow: 'hidden',
  },
  sweepWindow: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SWEEP_WIDTH,
    height: ECG_HEIGHT,
    overflow: 'hidden',
  },
  sweepInner: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});

// --- STYLES EN-TÊTE BANNIÈRE ---
const headerStyles = StyleSheet.create({
  headerBanner: {
    backgroundColor: '#901818',
    paddingTop: Platform.OS === 'ios' ? 20 : 16,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dropIcon: {
    fontSize: 26,
    marginRight: 8,
  },
  brandTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  arabicTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FCA5A5',
    marginLeft: 10,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#4ADE80',
    marginRight: 6,
  },
  liveText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  brandSubtitle: {
    fontSize: 13,
    color: '#FECACA',
    marginTop: 4,
    letterSpacing: 0.2,
  },
});

// --- STYLES ÉCRAN & FORMULAIRE ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContent: { flexGrow: 1, paddingBottom: 30 },
  formContent: { paddingHorizontal: 16, paddingTop: 16 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  cardHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#901818',
    textAlign: 'right',
    marginBottom: 14,
  },
  questionText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'right',
    marginBottom: 14,
  },
  inputContainer: { marginVertical: 6, alignItems: 'flex-end' },
  inputLabel: { fontSize: 13, color: '#334155', marginBottom: 6, fontWeight: '600' },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    width: '100%',
    textAlign: 'right',
    fontSize: 15,
    color: '#0F172A',
  },
  buttonRow: { flexDirection: 'row-reverse', justifyContent: 'space-between' },
  optionBtn: {
    flex: 0.48,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    alignItems: 'center',
  },
  optionBtnSelected: {
    backgroundColor: '#901818',
    borderColor: '#901818',
  },
  optionText: { fontSize: 15, fontWeight: '700', color: '#64748B' },
  optionTextSelected: { color: '#FFFFFF' },
  dateContainer: { marginTop: 15, alignItems: 'flex-end' },
  dateLabel: { fontSize: 13, color: '#475569', marginBottom: 6, fontWeight: '600' },
  datePickerBtn: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: 12,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  datePickerText: { fontSize: 15, color: '#901818', fontWeight: 'bold' },
  submitBtn: {
    backgroundColor: '#901818',
    paddingVertical: 15,
    borderRadius: 25,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 10,
    shadowColor: '#901818',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  submitBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: 'bold' },
});