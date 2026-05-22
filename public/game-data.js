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
      name: "Filme & Serien",
      questions: [
        { value: 100, question: "Welche Zeichentrick-Familie lebt in Springfield?", answer: "Die Simpsons" },
        { value: 200, question: "Aus was besteht das Schild von Captain America?", answer: "Vibranium" },
        { value: 300, question: "In welches Haus überlegt der sprechende Hut Harry Potter zu stecken, entscheidet sich aber doch um?", answer: "Slytherin" },
        { value: 400, question: "பWie lautet der Name des Gefängnisses, in dem Joker in The Dark Knight zeitweise eingesperrt ist?", answer: "Arkham Asylum" },
        { value: 500, question: "In Squid Game tragen die Wärter Masken mit verschiedenen Symbolen, welches dieser Symbole steht für niedrigsten Rang", answer: "Kreis" }
      ]
    },
    {
      name: "Erdkunde",
      questions: [
        { value: 100, question: "Wie heisst der tiefste Punkt der Erde?", answer: "Marianengraben" },
        { value: 200, question: "Welche Weltmetropole liegt als einzige Stadt der Welt auf 2 Kontinenten?", answer: "Istanbul" },
        { value: 300, question: "Welche 2 Länder haben die meisten direkten Nachbarstaaten?", answer: "Russland & China (jeweils 14)" },
        { value: 400, question: "Welcher Fluss fließt durch die meisten Länder der Welt?", answer: "die Donau" },
        { value: 500, question: "Was ist die Hauptstadt von Äthiopien?", answer: "Addis Abeba" }
      ]
    },
    {
      name: "Abkürzungen",
      questions: [
        { value: 100, question: "Für was steht PKW", answer: "Personenkraftwagen" },
        { value: 200, question: "Für was steht WLAN?", answer: "Wireless Local Area Network" },
        { value: 300, question: "Der Name der dänischen Klemmbausteine Lego ist eine Abkürzung für den dänischen Ausdruck Leg Godt. Was bedeutet das auf Deutsch?", answer: "Spiel gut" },
        { value: 400, question: "Wofür steht PDF?", answer: "Portable Document Format" },
        { value: 500, question: "Wofür steht ISBN (Nummer für Bücher)?", answer: "Internationale Standartbuchnummer" }
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
