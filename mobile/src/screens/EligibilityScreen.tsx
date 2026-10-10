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
// 📄 SCHÉMA DU QUESTIONNAIRE (généré depuis docs/questionnaire.v1.json)
// ------------------------------------------------------------------
const QUESTIONNAIRE = {
  version: 1,
  intro: {
    fr: "Ces questions permettent de vérifier que le don est sans risque pour vous et pour le patient. Vos réponses sont confidentielles et ne sont vues que par le personnel médical autorisé.",
    ar: "تساعدنا هذه الأسئلة على التأكد من أن التبرع آمن لك وللمريض. إجاباتك سرية ولا يطّلع عليها إلا الطاقم الطبي المخوَّل."
  },
  sensitiveNotice: {
    fr: "Question confidentielle. Répondez avec sincérité : cela protège les patients.",
    ar: "سؤال سرّي. أجب بصدق، فذلك يحمي المرضى."
  },
  labels: {
    yes: { fr: "Oui", ar: "نعم" },
    no: { fr: "Non", ar: "لا" },
    none: { fr: "Non concerné", ar: "غير معني" }
  },
  questions: [
    { id: "E01", field: "birthDate", type: "date", required: true, label: { fr: "Quelle est votre date de naissance ?", ar: "ما هو تاريخ ميلادك؟" } },
    { id: "E02", field: "weightKg", type: "number", required: true, min: 30, max: 250, unit: { fr: "kg", ar: "كغ" }, label: { fr: "Quel est votre poids ?", ar: "ما هو وزنك؟" }, help: { fr: "Un poids minimum est exigé pour donner son sang.", ar: "يُشترط حدّ أدنى للوزن للتبرع بالدم." } },
    { id: "E04", field: "feverInfectionRecent", type: "boolean", required: true, label: { fr: "Avez-vous eu de la fièvre ou une infection ces dernières semaines ?", ar: "هل أُصبت بحمّى أو عدوى خلال الأسابيع الأخيرة؟" } },
    { id: "E04b", field: "feverRecoveryDate", type: "date", required: false, showIf: { field: "feverInfectionRecent", equals: true }, label: { fr: "À quelle date avez-vous guéri ?", ar: "في أي تاريخ شُفيت؟" }, help: { fr: "Laissez vide si vous êtes encore malka.", ar: "اترك الحقل فارغًا إذا كنت ما زلت مريضًا." } },
    { id: "E05", field: "antibioticsEndDate", type: "date_or_none", required: false, allowFuture: true, label: { fr: "Prenez-vous ou avez-vous récemment pris des antibiotiques ? Indiquez la date de fin.", ar: "هل تتناول مضادات حيوية أو تناولتها مؤخرًا؟ أدخل تاريخ انتهاء العلاج." } },
    { id: "E06", field: "tattooPiercingDate", type: "date_or_none", required: false, label: { fr: "Avez-vous fait un tatouage, un piercing ou de l'acupuncture récemment ?", ar: "هل قمت بوشم أو ثقب في الجسم أو وخز بالإبر مؤخرًا؟ أدخل التاريخ." } },
    { id: "E07", field: "surgeryDate", type: "date_or_none", required: false, label: { fr: "Avez-vous subi une opération chirurgicale ou une endoscopie récemment ?", ar: "هل خضعت لعملية جراحية أو تنظير داخلي مؤخرًا؟ أدخل التاريخ." } },
    { id: "E08", field: "transfusionReceivedDate", type: "date_or_none", required: false, label: { fr: "Avez-vous reçu une transfusion sanguine ? Indiquez la date.", ar: "هل تلقيت عملية نقل دم؟ أدخل التاريخ." } },
    { id: "E09", field: "pregnant", type: "boolean", required: true, showIfProfile: { field: "sex", equals: "femme" }, label: { fr: "Êtes-vous enceinte actuellement ?", ar: "هل أنتِ حامل حاليًا؟" } },
    { id: "E09b", field: "deliveryDate", type: "date_or_none", required: false, showIfProfile: { field: "sex", equals: "femme" }, label: { fr: "Avez-vous accouché récemment ? Indiquez la date.", ar: "هل وضعتِ مولودًا مؤخرًا؟ أدخلي تاريخ الولادة." } },
    { id: "E10", field: "vaccinationDate", type: "date_or_none", required: false, label: { fr: "Avez-vous reçu un vaccin récemment ? Indiquez la date.", ar: "هل تلقيت لقاحًا مؤخرًا؟ أدخل التاريخ." } },
    { id: "E11", field: "malariaZoneReturnDate", type: "date_or_none", required: false, label: { fr: "Avez-vous séjourné dans une zone à risque de paludisme ?", ar: "هل أقمت في منطقة موبوءة بالملاريا؟ أدخل تاريخ عودتك." } },
    { id: "E12", field: "infectiousHistory", type: "boolean", required: true, sensitive: true, label: { fr: "Avez-vous déjà eu le VIH (sida), une hépatite B ou C, ou le HTLV ?", ar: "هل سبق أن أُصبت بفيروس نقص المناعة (السيدا) أو التهاب الكبد «ب»/«ج»؟" } },
    { id: "E13", field: "injectedDrugUseEver", type: "boolean", required: true, sensitive: true, label: { fr: "Avez-vous déjà consommé des drogues par injection ?", ar: "هل سبق أن تعاطيت مخدرات عن طريق الحقن؟" } },
    { id: "E14", field: "chronicDisease", type: "boolean", required: true, label: { fr: "Souffrez-vous d'une maladie chronique (cardiaque, épilepsie, diabète insuline...) ?", ar: "هل تعاني من مرض مزمن (أمراض القلب، الصرع، السكري مع أنسولين...)؟" } },
    { id: "E15", field: "regularMedication", type: "boolean", required: true, label: { fr: "Prenez-vous des médicaments de façon régulière ?", ar: "هل تتناول أدوية بشكل منتظم؟" } }
  ]
};

// ------------------------------------------------------------------
// 💓 ECG ANIMATION
// ------------------------------------------------------------------
const ECG_PERIOD = 200;
const ECG_HEIGHT = 44;
const SWEEP_WIDTH = 150;

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
      <View style={{ flexDirection: 'row' }}>
        {Array.from({ length: repeats }).map((_, i) => (
          <EcgPeriod key={i} color="rgba(255, 255, 255, 0.28)" thickness={1.5} />
        ))}
      </View>
      <Animated.View pointerEvents="none" style={[heartbeatStyles.sweepWindow, { transform: [{ translateX: sweepX }] }]}>
        <Animated.View style={[heartbeatStyles.sweepInner, { transform: [{ translateX: innerX }] }]}>
          <View style={{ flexDirection: 'row' }}>
            {Array.from({ length: repeats }).map((_, i) => (
              <EcgPeriod key={i} color="#FFFFFF" thickness={2.5} />
            ))}
          </View>
        </Animated.View>
      </Animated.View>
    </View>
  );
};

// ------------------------------------------------------------------
// 📱 COMPOSANT ÉCRAN D'ÉLIGIBILITÉ
// ------------------------------------------------------------------
export const EligibilityScreen = ({ navigation, route }: any) => {
  const [lang, setLang] = useState<'ar' | 'fr'>('ar');
  const isRtl = lang === 'ar';

  const userSex = route?.params?.user?.sex || 'homme';

  // État du formulaire
  const [answers, setAnswers] = useState<Record<string, any>>({
    birthDate: '2000-01-01',
    weightKg: '70',
    feverInfectionRecent: false,
    feverRecoveryDate: undefined,
    antibioticsEndDate: undefined,
    tattooPiercingDate: undefined,
    surgeryDate: undefined,
    transfusionReceivedDate: undefined,
    pregnant: false,
    deliveryDate: undefined,
    vaccinationDate: undefined,
    malariaZoneReturnDate: undefined,
    infectiousHistory: false,
    injectedDrugUseEver: false,
    chronicDisease: false,
    regularMedication: false,
    consent: false,
  });

  const [datePickerField, setDatePickerField] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const goToHomeScreen = () => {
    const token = route?.params?.accessToken;
    const currentUser = route?.params?.user;
    navigation.reset({
      index: 0,
      routes: [{ name: 'Home', params: { accessToken: token, user: currentUser } }],
    });
  };

  const updateAnswer = (field: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!answers.consent) {
      Alert.alert(
        lang === 'ar' ? 'تنبيه' : 'Attention',
        lang === 'ar' ? 'يرجى بالموافقة على الإقرار قبل الإرسال' : 'Veuillez accepter la déclaration de consentement.'
      );
      return;
    }

    const weightNum = parseFloat(answers.weightKg);
    if (isNaN(weightNum) || weightNum < 30 || weightNum > 250) {
      Alert.alert(
        lang === 'ar' ? 'خطأ' : 'Erreur',
        lang === 'ar' ? 'يرجى إدخال وزن صحيح بين 30 و 250 كغ' : 'Veuillez entrer un poids valide entre 30 et 250 kg.'
      );
      return;
    }

    const token = route?.params?.accessToken;
    const userId = route?.params?.user?.id || route?.params?.user?.userId;

    if (!token || !userId) {
      Alert.alert(
        lang === 'ar' ? 'خطأ' : 'Erreur',
        lang === 'ar' ? 'جلسة غير صالحة، يرجى إعادة التسجيل' : 'Session invalide, veuillez vous reconnecter.'
      );
      navigation.navigate('Auth');
      return;
    }

    setLoading(true);

    const dtoPayload: EligibilityAnswers = {
      birthDate: answers.birthDate || '2000-01-01',
      weightKg: weightNum,
      feverInfectionRecent: !!answers.feverInfectionRecent,
      feverRecoveryDate: answers.feverInfectionRecent ? answers.feverRecoveryDate : undefined,
      antibioticsEndDate: answers.antibioticsEndDate,
      tattooPiercingDate: answers.tattooPiercingDate,
      surgeryDate: answers.surgeryDate,
      transfusionReceivedDate: answers.transfusionReceivedDate,
      pregnant: userSex === 'femme' ? !!answers.pregnant : undefined,
      deliveryDate: userSex === 'femme' ? answers.deliveryDate : undefined,
      vaccinationDate: answers.vaccinationDate,
      malariaZoneReturnDate: answers.malariaZoneReturnDate,
      infectiousHistory: !!answers.infectiousHistory,
      injectedDrugUseEver: !!answers.injectedDrugUseEver,
      chronicDisease: !!answers.chronicDisease,
      regularMedication: !!answers.regularMedication,
      consent: true,
    };

    try {
      const evaluation = await submitEligibilityForm(dtoPayload, token, userId);

      if (evaluation.isEligible) {
        Alert.alert(
          lang === 'ar' ? 'نتيجة الاختبار 🩸' : 'Résultat 🩸',
          lang === 'ar' ? 'أنت مؤهل للتبرع بالدم !' : 'Vous êtes éligible au don de sang !',
          [{ text: lang === 'ar' ? 'موافق' : 'OK', onPress: goToHomeScreen }]
        );
      } else {
        const reasonsList = Array.isArray(evaluation.reasons) ? evaluation.reasons : [];
        const reasonsText = reasonsList.length > 0
          ? reasonsList.map((r) => `• ${r}`).join('\n')
          : (lang === 'ar' ? 'غير مؤهل للتبرع حالياً.' : 'Non éligible pour le moment.');

        Alert.alert(
          lang === 'ar' ? 'غير مؤهل للتبرع حالياً ⚠️' : 'Non éligible actuellement ⚠️',
          `${reasonsText}`,
          [{ text: lang === 'ar' ? 'حسناً' : 'Compris', onPress: goToHomeScreen }]
        );
      }
    } catch (error: any) {
      Alert.alert(lang === 'ar' ? 'خطأ' : 'Erreur', String(error?.message || 'Erreur réseau'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* EN-TÊTE AVEC BOUTON DE LANGUE ET ECG */}
        <View style={headerStyles.headerBanner}>
          <View style={headerStyles.topRow}>
            <View style={headerStyles.brandContainer}>
              <Text style={headerStyles.dropIcon}>🩸</Text>
              <Text style={headerStyles.brandTitle}>Damm</Text>
              <Text style={headerStyles.arabicTitle}>دمّ</Text>
            </View>

            {/* Switch de Langue */}
            <TouchableOpacity
              style={headerStyles.langBtn}
              onPress={() => setLang(lang === 'ar' ? 'fr' : 'ar')}
            >
              <Text style={headerStyles.langBtnText}>{lang === 'ar' ? 'FR 🇫🇷' : 'عربي 🇹🇳'}</Text>
            </TouchableOpacity>
          </View>

          <Text style={[headerStyles.brandSubtitle, { textAlign: isRtl ? 'right' : 'left' }]}>
            {QUESTIONNAIRE.intro[lang]}
          </Text>

          <AnimatedHeartbeat />
        </View>

        {/* RENDER DYNAMIQUE DES QUESTIONS */}
        <View style={styles.formContent}>
          {QUESTIONNAIRE.questions.map((q) => {
            // Check showIfProfile
            if (q.showIfProfile && q.showIfProfile.field === 'sex' && userSex !== q.showIfProfile.equals) {
              return null;
            }

            // Check showIf
            if (q.showIf && answers[q.showIf.field] !== q.showIf.equals) {
              return null;
            }

            return (
              <View key={q.id} style={styles.card}>
                <Text style={[styles.questionText, { textAlign: isRtl ? 'right' : 'left' }]}>
                  {q.label[lang]}
                </Text>

                {q.help && (
                  <Text style={[styles.helpText, { textAlign: isRtl ? 'right' : 'left' }]}>
                    {q.help[lang]}
                  </Text>
                )}

                {/* TYPE 1: NUMBER */}
                {q.type === 'number' && (
                  <View style={[styles.inputRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
                    <TextInput
                      style={[styles.textInput, { textAlign: isRtl ? 'right' : 'left' }]}
                      keyboardType="numeric"
                      value={String(answers[q.field] ?? '')}
                      onChangeText={(val) => updateAnswer(q.field, val)}
                      maxLength={3}
                      placeholderTextColor="#94A3B8"
                    />
                    {q.unit && <Text style={styles.unitText}>{q.unit[lang]}</Text>}
                  </View>
                )}

                {/* TYPE 2: BOOLEAN */}
                {q.type === 'boolean' && (
                  <View style={[styles.buttonRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
                    <TouchableOpacity
                      style={[styles.optionBtn, answers[q.field] === true && styles.optionBtnSelected]}
                      onPress={() => updateAnswer(q.field, true)}
                    >
                      <Text style={[styles.optionText, answers[q.field] === true && styles.optionTextSelected]}>
                        {QUESTIONNAIRE.labels.yes[lang]}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.optionBtn, answers[q.field] === false && styles.optionBtnSelected]}
                      onPress={() => updateAnswer(q.field, false)}
                    >
                      <Text style={[styles.optionText, answers[q.field] === false && styles.optionTextSelected]}>
                        {QUESTIONNAIRE.labels.no[lang]}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* TYPE 3 & 4: DATE / DATE_OR_NONE */}
                {(q.type === 'date' || q.type === 'date_or_none') && (
                  <View>
                    <View style={[styles.buttonRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
                      <TouchableOpacity
                        style={[
                          styles.datePickerBtn,
                          answers[q.field] && styles.datePickerBtnActive,
                        ]}
                        onPress={() => setDatePickerField(q.field)}
                      >
                        <Text style={styles.datePickerText}>
                          {answers[q.field] || (lang === 'ar' ? 'اختر التاريخ 📅' : 'Choisir date 📅')}
                        </Text>
                      </TouchableOpacity>

                      {q.type === 'date_or_none' && (
                        <TouchableOpacity
                          style={[
                            styles.noneBtn,
                            answers[q.field] === undefined && styles.noneBtnSelected,
                          ]}
                          onPress={() => updateAnswer(q.field, undefined)}
                        >
                          <Text style={[styles.noneText, answers[q.field] === undefined && styles.noneTextSelected]}>
                            {QUESTIONNAIRE.labels.none[lang]}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {datePickerField === q.field && (
                      <DateTimePicker
                        value={answers[q.field] ? new Date(answers[q.field]) : new Date()}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        maximumDate={q.allowFuture ? undefined : new Date()}
                        onChange={(e, selectedDate) => {
                          setDatePickerField(null);
                          if (selectedDate) {
                            updateAnswer(q.field, selectedDate.toISOString().split('T')[0]);
                          }
                        }}
                      />
                    )}
                  </View>
                )}

                {/* NOTIFICATION QUESTION SENSIBLE */}
                {q.sensitive && (
                  <View style={styles.sensitiveNoticeBox}>
                    <Text style={[styles.sensitiveNoticeText, { textAlign: isRtl ? 'right' : 'left' }]}>
                      🔒 {QUESTIONNAIRE.sensitiveNotice[lang]}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}

          {/* CONSENTEMENT EXPLICITE AVANT ENVOI */}
          <TouchableOpacity
            style={[styles.consentRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}
            onPress={() => updateAnswer('consent', !answers.consent)}
          >
            <View style={[styles.checkbox, answers.consent && styles.checkboxChecked]}>
              {answers.consent && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={[styles.consentText, { textAlign: isRtl ? 'right' : 'left' }]}>
              {lang === 'ar'
                ? 'أقرّ بصحة إجاباتي وأوافق على تقييم أهليتي للتبرع.'
                : 'J’atteste de la véracité de mes réponses et donne mon consentement.'}
            </Text>
          </TouchableOpacity>

          {/* BOUTON DE SOUMISSION */}
          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitBtnText}>
                {lang === 'ar' ? 'تأكيد وإرسال الاستمارة 🩸' : 'Confirmer et envoyer 🩸'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

// --- STYLES HEARTBEAT ECG ---
const heartbeatStyles = StyleSheet.create({
  container: { height: ECG_HEIGHT, marginTop: 12, marginHorizontal: -20, overflow: 'hidden' },
  sweepWindow: { position: 'absolute', top: 0, left: 0, width: SWEEP_WIDTH, height: ECG_HEIGHT, overflow: 'hidden' },
  sweepInner: { position: 'absolute', top: 0, left: 0 },
});

// --- STYLES BANNIÈRE EN-TÊTE ---
const headerStyles = StyleSheet.create({
  headerBanner: {
    backgroundColor: '#901818',
    paddingTop: Platform.OS === 'ios' ? 20 : 16,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    elevation: 8,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brandContainer: { flexDirection: 'row', alignItems: 'center' },
  dropIcon: { fontSize: 26, marginRight: 8 },
  brandTitle: { fontSize: 32, fontWeight: '900', color: '#FFFFFF' },
  arabicTitle: { fontSize: 24, fontWeight: '700', color: '#FCA5A5', marginLeft: 10 },
  langBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  langBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 13 },
  brandSubtitle: { fontSize: 13, color: '#FECACA', marginTop: 10, lineHeight: 18 },
});

// --- STYLES ÉCRAN & FORMULAIRE ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContent: { flexGrow: 1, paddingBottom: 30 },
  formContent: { paddingHorizontal: 16, paddingTop: 16 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    elevation: 2,
  },
  questionText: { fontSize: 15, fontWeight: '700', color: '#1E293B', marginBottom: 10 },
  helpText: { fontSize: 12, color: '#64748B', marginBottom: 10 },
  inputRow: { alignItems: 'center', gap: 10 },
  textInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    color: '#0F172A',
  },
  unitText: { fontSize: 15, fontWeight: 'bold', color: '#475569' },
  buttonRow: { justifyContent: 'space-between', gap: 10 },
  optionBtn: {
    flex: 0.48,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    alignItems: 'center',
  },
  optionBtnSelected: { backgroundColor: '#901818', borderColor: '#901818' },
  optionText: { fontSize: 15, fontWeight: '700', color: '#64748B' },
  optionTextSelected: { color: '#FFFFFF' },
  datePickerBtn: {
    flex: 1,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  datePickerBtnActive: { backgroundColor: '#FEE2E2', borderColor: '#EF4444' },
  datePickerText: { fontSize: 14, color: '#901818', fontWeight: 'bold' },
  noneBtn: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    alignItems: 'center',
  },
  noneBtnSelected: { backgroundColor: '#475569', borderColor: '#475569' },
  noneText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  noneTextSelected: { color: '#FFFFFF' },
  sensitiveNoticeBox: {
    marginTop: 10,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 8,
    padding: 8,
  },
  sensitiveNoticeText: { fontSize: 12, color: '#B45309' },
  consentRow: { alignItems: 'center', gap: 10, marginVertical: 16, paddingHorizontal: 4 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#901818',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: { backgroundColor: '#901818' },
  checkmark: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 },
  consentText: { flex: 1, fontSize: 13, color: '#334155', fontWeight: '600' },
  submitBtn: {
    backgroundColor: '#901818',
    paddingVertical: 15,
    borderRadius: 25,
    alignItems: 'center',
    marginBottom: 20,
    elevation: 4,
  },
  submitBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
});