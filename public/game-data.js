// JEOPARDY GAME DATA - Hier kannst du alle Fragen ändern!

const GAME_DATA = {
  categoriesRound1: [
    {
      name: "தமிழ் சினிமா",
      questions: [
        { value: 100, question: "\"சூப்பர் ஸ்டார்\" என்ற பட்டம் பெற்ற நடிகர் யார்?\nWelcher Schauspieler trägt den Titel \"Superstar\"?", answer: "ரஜினிகாந்த் / Rajinikanth" },
        { value: 200, question: "\"தளபதி\" என்று அன்பர்களால் அழைக்கப்படும் நடிகர் யார்?\nWelcher Schauspieler wird von Fans \"Thalapathy\" genannt?", answer: "விஜய் / Vijay" },
        { value: 300, question: "\"பொன்னியின் செல்வன்\" திரைப்படத்தின் இயக்குநர் யார்?\nWer ist der Regisseur von \"Ponniyin Selvan\"?", answer: "மணிரத்னம் / Mani Ratnam" },
        { value: 400, question: "ஆஸ்கர் விருது பெற்ற தமிழ் இசையமைப்பாளர் யார்?\nWelcher tamilische Komponist gewann einen Oscar?", answer: "ஏ.ஆர். ரஹ்மான் / A.R. Rahman" },
        { value: 500, question: "\"இந்தியன்\", \"முதல்வன்\", \"அந்நியன்\" படங்களை இயக்கியவர் யார்?\nWer führte Regie bei \"Indian\", \"Mudhalvan\" und \"Anniyan\"?", answer: "ஷங்கர் / Shankar" }
      ]
    },
    {
      name: "தமிழ் பண்பாடு",
      questions: [
        { value: 100, question: "பொங்கல் பண்டிகை எந்த மாதத்தில் கொண்டாடப்படுகிறது?\nIn welchem Monat wird das Pongal-Fest gefeiert?", answer: "ஜனவரி (தை மாதம்) / Januar" },
        { value: 200, question: "தீபாவளி அன்று காலையில் முதலில் என்ன செய்வது வழக்கம்?\nWas macht man traditionell am Deepavali-Morgen zuerst?", answer: "எண்ணெய் குளியல் / Ölbad" },
        { value: 300, question: "\"ஜல்லிக்கட்டு\" என்றால் என்ன?\nWas ist \"Jallikattu\"?", answer: "காளை அடக்கும் விளையாட்டு / Stierzähmung" },
        { value: 400, question: "தமிழ் திருமணத்தில் மணமகன் மணமகளுக்கு என்ன கட்டுவான்?\nWas bindet der Bräutigam der Braut bei einer tamilischen Hochzeit um?", answer: "தாலி / Thaali (Hochzeitskette)" },
        { value: 500, question: "தமிழ் புத்தாண்டு எந்த மாதத்தில் வருகிறது?\nIn welchem Monat ist das tamilische Neujahr?", answer: "ஏப்ரல் (சித்திரை) / April" }
      ]
    },
    {
      name: "தமிழ் உணவு",
      questions: [
        { value: 100, question: "இட்லிக்கு பொதுவாக என்ன தொட்டுக்கொள்வோம்?\nWas isst man normalerweise zu Idli dazu?", answer: "சாம்பார் & சட்னி / Sambar & Chutney" },
        { value: 200, question: "பொங்கல் பண்டிகையில் சமைக்கப்படும் இனிப்பு உணவு எது?\nWelches süsse Gericht wird an Pongal gekocht?", answer: "சர்க்கரைப் பொங்கல் / Süsser Pongal" },
        { value: 300, question: "தோசை மாவு எதிலிருந்து தயாரிக்கப்படுகிறது?\nWoraus wird Dosa-Teig hergestellt?", answer: "அரிசி & உளுந்து / Reis & Urad-Dal" },
        { value: 400, question: "\"செட்டிநாடு சிக்கன்\" எந்த பகுதியின் சிறப்பு உணவு?\nAus welcher Region stammt \"Chettinad Chicken\"?", answer: "செட்டிநாடு / Chettinad" },
        { value: 500, question: "\"பாயசம்\" செய்ய முக்கிய இனிப்புப் பொருள் என்ன?\nWas ist die wichtigste süsse Zutat für \"Payasam\"?", answer: "வெல்லம் / Jaggery (Palmzucker)" }
      ]
    },
    {
      name: "யார் இது?",
      questions: [
        { value: 100, type: "image", question: "இவர் யார்? / Wer ist das?", answer: "ரஜினிகாந்த் / Rajinikanth", imageUrl: "/images/questions/r1_wer_100.jpg" },
        { value: 200, type: "image", question: "இவர் யார்? / Wer ist das?", answer: "ஏ.ஆர். ரஹ்மான் / A.R. Rahman", imageUrl: "/images/questions/r1_wer_200.jpg" },
        { value: 300, type: "image", question: "இவர் யார்? / Wer ist das?", answer: "லியோனல் மெஸ்ஸி / Lionel Messi", imageUrl: "/images/questions/r1_wer_300.jpg" },
        { value: 400, type: "image", question: "இவர் யார்? / Wer ist das?", answer: "சிவாஜி கணேசன் / Sivaji Ganesan", imageUrl: "/images/questions/r1_wer_400.jpg" },
        { value: 500, type: "image", question: "இது என்ன இடம்? / Was ist das für ein Ort?", answer: "தாஜ் மஹால் / Taj Mahal", imageUrl: "/images/questions/r1_wer_500.jpg" }
      ]
    },
    {
      name: "மதிப்பீடு",
      questions: [
        { value: 100, type: "estimate", timeLimit: 30, question: "தமிழ் மொழி எத்தனை ஆண்டுகள் பழமையானது?\nWie viele Jahre alt ist die tamilische Sprache?", answer: "2500" },
        { value: 200, type: "estimate", timeLimit: 30, question: "தமிழ்நாட்டின் மக்கள் தொகை எவ்வளவு கோடி?\nWie viele Crore Einwohner hat Tamil Nadu? (1 Crore = 10 Mio.)", answer: "8" },
        { value: 300, type: "estimate", timeLimit: 30, question: "ரஜினிகாந்த் இதுவரை எத்தனை படங்களில் நடித்துள்ளார்?\nIn wie vielen Filmen hat Rajinikanth mitgespielt?", answer: "170" },
        { value: 400, type: "estimate", timeLimit: 35, question: "உலகில் எத்தனை கோடி பேர் தமிழ் பேசுகிறார்கள்?\nWie viele Crore Menschen weltweit sprechen Tamil?", answer: "8" },
        { value: 500, type: "estimate", timeLimit: 40, question: "சென்னையின் மக்கள் தொகை எத்தனை லட்சம்?\nWie viele Lakh Einwohner hat Chennai? (1 Lakh = 100'000)", answer: "100" }
      ]
    }
  ],
  
  categoriesRound2: [
    {
      name: "பொது அறிவு",
      questions: [
        { value: 100, question: "உலகின் மிகப்பெரிய கடல் எது?\nWelcher ist der grösste Ozean der Welt?", answer: "பசிபிக் பெருங்கடல் / Pazifik" },
        { value: 200, question: "ஐபிள் கோபுரம் எந்த நாட்டில் உள்ளது?\nIn welchem Land steht der Eiffelturm?", answer: "பிரான்ஸ் (பாரிஸ்) / Frankreich (Paris)" },
        { value: 300, question: "ஒரு கால்பந்து அணியில் எத்தனை பேர் விளையாடுவார்கள்?\nWie viele Spieler hat eine Fussballmannschaft?", answer: "11" },
        { value: 400, question: "பூமியிலிருந்து சந்திரனுக்குச் செல்ல முதல் மனிதன் யார்?\nWer war der erste Mensch auf dem Mond?", answer: "நீல் ஆர்ம்ஸ்ட்ராங் / Neil Armstrong" },
        { value: 500, question: "\"மோனா லிசா\" ஓவியத்தை வரைந்தவர் யார்?\nWer hat die \"Mona Lisa\" gemalt?", answer: "லியனார்டோ டா வின்சி / Leonardo da Vinci" }
      ]
    },
    {
      name: "தமிழ்நாடு",
      questions: [
        { value: 100, question: "மதுரையின் புகழ்பெற்ற கோயில் எது?\nWelcher berühmte Tempel steht in Madurai?", answer: "மீனாட்சி அம்மன் கோயில் / Meenakshi Tempel" },
        { value: 200, question: "ஊட்டியின் மற்றொரு பெயர் என்ன?\nWie lautet der andere Name von Ooty?", answer: "உதகமண்டலம் / Udhagamandalam" },
        { value: 300, question: "\"கோவில் நகரம்\" என்று அழைக்கப்படும் நகரம் எது?\nWelche Stadt wird \"Tempelstadt\" genannt?", answer: "காஞ்சிபுரம் / Kanchipuram" },
        { value: 400, question: "ராமேஸ்வரம் எதற்கு புகழ்பெற்றது?\nWofür ist Rameswaram berühmt?", answer: "ராமநாதசுவாமி கோயில் / Ramanathaswamy Tempel" },
        { value: 500, question: "தமிழ்நாட்டின் மிக நீளமான நதி எது?\nWelcher ist der längste Fluss in Tamil Nadu?", answer: "காவிரி / Kaveri" }
      ]
    },
    {
      name: "விளையாட்டு & உலகம்",
      questions: [
        { value: 100, question: "ஒலிம்பிக் போட்டிகள் எத்தனை ஆண்டுகளுக்கு ஒருமுறை நடைபெறும்?\nAlle wie viele Jahre finden die Olympischen Spiele statt?", answer: "4 ஆண்டுகள் / 4 Jahre" },
        { value: 200, question: "கிரிக்கெட்டில் ஒரு ஓவரில் எத்தனை பந்துகள் வீசப்படும்?\nWie viele Bälle hat ein Over im Cricket?", answer: "6" },
        { value: 300, question: "உலகின் மிக உயரமான மலை எது?\nWelcher ist der höchste Berg der Welt?", answer: "எவரெஸ்ட் / Mount Everest" },
        { value: 400, question: "சாக்லெட் எந்த கொட்டையிலிருந்து தயாரிக்கப்படுகிறது?\nAus welcher Bohne wird Schokolade hergestellt?", answer: "கொக்கோ கொட்டை / Kakaobohne" },
        { value: 500, question: "ஸ்விட்சர்லாந்தின் தலைநகரம் எது?\nWie heisst die Hauptstadt der Schweiz?", answer: "பெர்ன் / Bern" }
      ]
    },
    {
      name: "யார்/என்ன இது?",
      questions: [
        { value: 100, type: "image", question: "இவர் யார்? / Wer ist das?", answer: "விஜய் / Vijay", imageUrl: "/images/questions/r2_wer_100.jpg" },
        { value: 200, type: "image", question: "இது என்ன கோயில்? / Was ist das für ein Tempel?", answer: "மீனாட்சி அம்மன் கோயில் / Meenakshi Tempel", imageUrl: "/images/questions/r2_wer_200.jpg" },
        { value: 300, type: "image", question: "இவர் யார்? / Wer ist das?", answer: "தனுஷ் / Dhanush", imageUrl: "/images/questions/r2_wer_300.jpg" },
        { value: 400, type: "image", question: "இது என்ன கோயில்? / Was ist das für ein Tempel?", answer: "தஞ்சை பெரிய கோயில் / Thanjavur Big Temple", imageUrl: "/images/questions/r2_wer_400.jpg" },
        { value: 500, type: "image", question: "இவர் யார்? / Wer ist das?", answer: "கமல்ஹாசன் / Kamal Haasan", imageUrl: "/images/questions/r2_wer_500.jpg" }
      ]
    },
    {
      name: "மதிப்பீடு",
      questions: [
        { value: 100, type: "estimate", timeLimit: 30, question: "திருக்குறளில் எத்தனை குறள்கள் உள்ளன?\nWie viele Verse enthält das Thirukkural?", answer: "1330" },
        { value: 200, type: "estimate", timeLimit: 30, question: "ஏ.ஆர். ரஹ்மான் எத்தனை படங்களுக்கு இசையமைத்துள்ளார்?\nFür wie viele Filme hat A.R. Rahman Musik komponiert? (ca.)", answer: "150" },
        { value: 300, type: "estimate", timeLimit: 30, question: "தமிழ் சினிமாவின் முதல் படம் எந்த வருடம் வெளியானது?\nIn welchem Jahr erschien der erste tamilische Film?", answer: "1931" },
        { value: 400, type: "estimate", timeLimit: 35, question: "இலங்கையில் எத்தனை சதவீத மக்கள் தமிழர்கள்?\nWie viel Prozent der Bevölkerung Sri Lankas sind Tamilen?", answer: "15" },
        { value: 500, type: "estimate", timeLimit: 40, question: "தமிழில் மொத்தம் எத்தனை எழுத்துக்கள் உள்ளன?\nWie viele Buchstaben hat das tamilische Alphabet?", answer: "247" }
      ]
    }
  ]
};
