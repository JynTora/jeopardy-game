// JEOPARDY GAME DATA - Hier kannst du alle Fragen ändern!

const GAME_DATA = {
  categoriesRound1: [
    {
      name: "Zurück in die Schule",
      questions: [
        { value: 100, question: "Welche Farbe leuchtet bei einer Ampel ganz oben?", answer: "Rot" },
        { value: 200, question: "Nenne alle bestimmten Artikel in der Grammatik", answer: "Der Die Das" },
        { value: 300, question: "Wie nennt man ein Wort, das das Gegenteil eines anderen Wortes bedeutet", answer: "Antonym" },
        { value: 400, question: "Welches chemische Element ist \"NE\"?", answer: "Neon" },
        { value: 500, question: "Wie heissen die Kraftwerke der Zelle?", answer: "Mitochondrien" }
      ]
    },
    {
      name: "Körper & Gesundheit",
      questions: [
        { value: 100, question: "Wie nennt man die Gesamtheit aller Knochen in unserem Körper?", answer: "Skelett" },
        { value: 200, question: "Welches ist Flächenmässig das grösste Organ des menschlichen Körpers?", answer: "die Haut" },
        { value: 300, question: "Wie viele Knochen hat ein erwachsener Mensch?", answer: "206" },
        { value: 400, question: "Welches dieser Organe besitzt die erstaunliche Fähigkeit, sich fast vollständig zu regenerieren, selbst wenn große Teile davon entfernt werden?", answer: "die Leber" },
        { value: 500, question: "Was passiert im Körper beim sogennanten Patellarsehnenreflex?", answer: "Das Bein schnellt nach vorn" }
      ]
    },
    {
      name: "Gesetze",
      questions: [
        { value: 100, question: "Was muss man bei der \"Rettungsgasse\" machen", answer: "bei Stau nach links/rechts fahren, damit in der Mitte eine Gasse bleibt" },
        { value: 200, question: "Ab welchem Alter sind Deutsche gesetzlich dazu verpflichtet, einen gültigen Ausweis zu besitzen?", answer: "ab 16 Jahren" },
        { value: 300, question: "Wie nennt man das Recht, bei einer Aussage vor Gericht zu schweigen, damit man sich nicht selbst belastet?", answer: "Aussageverweigerungsrecht" },
        { value: 400, question: "Wenn du Geld findest und im Fundbüro abgibst: Ab welchem Wert musst du den Fund gesetzlich melden?", answer: "ab 10 Franken" },
        { value: 500, question: "Was ist die Grundvoraussetzung damit eine Tat als \"Notwehr\" (§ 32 StGB) gilt?", answer: "dass ein gegenwärtiger, rechtswidriger Angriff vorliegt" }
      ]
    },
    {
      name: "Flaggen",
      questions: [
        { value: 100, type: "image", question: "Welche Flagge ist das?", answer: "Tunesien", imageUrl: "/images/r1_wer_100.jpg" },
        { value: 200, type: "image", question: "Welche Flagge ist das?", answer: "Georgien", imageUrl: "/images/r1_wer_200.jpg" },
        { value: 300, type: "image", question: "Welche Flagge ist das?", answer: "Pakistan", imageUrl: "/images/r1_wer_300.jpg" },
        { value: 400, type: "image", question: "Welche Flagge ist das?", answer: "Gabun", imageUrl: "/images/r1_wer_400.jpg" },
        { value: 500, type: "image", question: "Welche Flagge ist das?", answer: "Kambodscha", imageUrl: "/images/r1_wer_500.jpg" }
      ]
    },
    {
      name: "Schätzen",
      questions: [
        { value: 100, type: "estimate", timeLimit: 30, question: "Wie viele Tasten hat ein klassisches Klavier?", answer: "88" },
        { value: 200, type: "estimate", timeLimit: 30, question: "Wie viele Tage hat ein Schaltjahr?", answer: "366" },
        { value: 300, type: "estimate", timeLimit: 30, question: "Wie hoch ist der Eiffelturm in Paris ungefähr in Metern?", answer: "330" },
        { value: 400, type: "estimate", timeLimit: 35, question: "Wie viele Kilometer lang ist der Nil ungefähr", answer: "6650" },
        { value: 500, type: "estimate", timeLimit: 40, question: "Wie viele Knochen hat ein neugeborenes Baby ungefähr?", answer: "300" }
      ]
    }
  ],
  
  categoriesRound2: [
    {
      name: "பொது அறிவு/Menschenverstand",
      questions: [
        { value: 100, question: "உலகின் மிகப்பெரிய கடல் எது?\nWelcher ist der grösste Ozean der Welt?", answer: "பசிபிக் பெருங்கடல் / Pazifik" },
        { value: 200, question: "ஐபிள் கோபுரம் எந்த நாட்டில் உள்ளது?\nIn welchem Land steht der Eiffelturm?", answer: "பிரான்ஸ் (பாரிஸ்) / Frankreich (Paris)" },
        { value: 300, question: "ஒரு கால்பந்து அணியில் எத்தனை பேர் விளையாடுவார்கள்?\nWie viele Spieler hat eine Fussballmannschaft?", answer: "11" },
        { value: 400, question: "பூமியிலிருந்து சந்திரனுக்குச் செல்ல முதல் மனிதன் யார்?\nWer war der erste Mensch auf dem Mond?", answer: "நீல் ஆர்ம்ஸ்ட்ராங் / Neil Armstrong" },
        { value: 500, question: "\"மோனா லிசா\" ஓவியத்தை வரைந்தவர் யார்?\nWer hat die \"Mona Lisa\" gemalt?", answer: "லியனார்டோ டா வின்சி / Leonardo da Vinci" }
      ]
    },
    {
      name: "தமிழ்நாடு/Tamil Nadu",
      questions: [
        { value: 100, question: "மதுரையின் புகழ்பெற்ற கோயில் எது?\nWelcher berühmte Tempel steht in Madurai?", answer: "மீனாட்சி அம்மன் கோயில் / Meenakshi Tempel" },
        { value: 200, question: "ஊட்டியின் மற்றொரு பெயர் என்ன?\nWie lautet der andere Name von Ooty?", answer: "உதகமண்டலம் / Udhagamandalam" },
        { value: 300, question: "\"கோவில் நகரம்\" என்று அழைக்கப்படும் நகரம் எது?\nWelche Stadt wird \"Tempelstadt\" genannt?", answer: "காஞ்சிபுரம் / Kanchipuram" },
        { value: 400, question: "ராமேஸ்வரம் எதற்கு புகழ்பெற்றது?\nWofür ist Rameswaram berühmt?", answer: "ராமநாதசுவாமி கோயில் / Ramanathaswamy Tempel" },
        { value: 500, question: "தமிழ்நாட்டின் மிக நீளமான நதி எது?\nWelcher ist der längste Fluss in Tamil Nadu?", answer: "காவிரி / Kaveri" }
      ]
    },
    {
      name: "விளையாட்டு & உலகம்/Sport & Welt",
      questions: [
        { value: 100, question: "ஒலிம்பிக் போட்டிகள் எத்தனை ஆண்டுகளுக்கு ஒருமுறை நடைபெறும்?\nAlle wie viele Jahre finden die Olympischen Spiele statt?", answer: "4 ஆண்டுகள் / 4 Jahre" },
        { value: 200, question: "கிரிக்கெட்டில் ஒரு ஓவரில் எத்தனை பந்துகள் வீசப்படும்?\nWie viele Bälle hat ein Over im Cricket?", answer: "6" },
        { value: 300, question: "உலகின் மிக உயரமான மலை எது?\nWelcher ist der höchste Berg der Welt?", answer: "எவரெஸ்ட் / Mount Everest" },
        { value: 400, question: "சாக்லெட் எந்த கொட்டையிலிருந்து தயாரிக்கப்படுகிறது?\nAus welcher Bohne wird Schokolade hergestellt?", answer: "கொக்கோ கொட்டை / Kakaobohne" },
        { value: 500, question: "ஸ்விட்சர்லாந்தின் தலைநகரம் எது?\nWie heisst die Hauptstadt der Schweiz?", answer: "பெர்ன் / Bern" }
      ]
    },
    {
      name: "யார்/என்ன இது?/Wer/Was ist das?",
      questions: [
        { value: 100, type: "image", question: "இவர் யார்? / Wer ist das?", answer: "விஜய் / Vijay", imageUrl: "/images/questions/r2_wer_100.jpg" },
        { value: 200, type: "image", question: "இது என்ன கோயில்? / Was ist das für ein Tempel?", answer: "மீனாட்சி அம்மன் கோயில் / Meenakshi Tempel", imageUrl: "/images/questions/r2_wer_200.jpg" },
        { value: 300, type: "image", question: "இவர் யார்? / Wer ist das?", answer: "தனுஷ் / Dhanush", imageUrl: "/images/questions/r2_wer_300.jpg" },
        { value: 400, type: "image", question: "இது என்ன கோயில்? / Was ist das für ein Tempel?", answer: "தஞ்சை பெரிய கோயில் / Thanjavur Big Temple", imageUrl: "/images/questions/r2_wer_400.jpg" },
        { value: 500, type: "image", question: "இவர் யார்? / Wer ist das?", answer: "கமல்ஹாசன் / Kamal Haasan", imageUrl: "/images/questions/r2_wer_500.jpg" }
      ]
    },
    {
      name: "மதிப்பீடு/auswerten",
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
