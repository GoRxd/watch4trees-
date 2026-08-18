export interface QuizOption {
  id: string;
  textPl: string;
  textEn: string;
}

export interface RawQuizOption {
  textPl: string;
  textEn: string;
  isCorrect?: boolean;
}

export interface QuizQuestionDefinition {
  id: string;
  questionPl: string;
  questionEn: string;
  options: RawQuizOption[];
}

export interface SanitizedQuiz {
  id: string;
  questionPl: string;
  questionEn: string;
  options: QuizOption[];
  correctOptionId: string; // kept on server for token payload
}

const QUIZ_POOL: QuizQuestionDefinition[] = [
  {
    id: 'quiz_tree_co2',
    questionPl: 'Ile przeciętnie kilogramów CO2 rocznie pochłania jedno dorosłe drzewo liściaste?',
    questionEn: 'On average, how many kilograms of CO2 does a mature deciduous tree absorb per year?',
    options: [
      { textPl: 'Około 22 kg CO2 / rok', textEn: 'About 22 kg CO2 / year', isCorrect: true },
      { textPl: 'Mniej niż 1 kg CO2 / rok', textEn: 'Less than 1 kg CO2 / year' },
      { textPl: 'Ponad 5000 kg CO2 / rok', textEn: 'Over 5000 kg CO2 / year' },
      { textPl: '0 kg (drzewa emitują CO2)', textEn: '0 kg (trees only emit CO2)' }
    ]
  },
  {
    id: 'quiz_oxygen_producer',
    questionPl: 'Który ekosystem produkuje ponad 50% tlenu na kuli ziemskiej?',
    questionEn: 'Which ecosystem produces over 50% of the Earth\'s oxygen?',
    options: [
      { textPl: 'Oceany (fitoplankton morski)', textEn: 'Oceans (marine phytoplankton)', isCorrect: true },
      { textPl: 'Pustynie i sawanny', textEn: 'Deserts and savannas' },
      { textPl: 'Tylko europejskie parki miejskie', textEn: 'Only European city parks' },
      { textPl: 'Tundry arktyczne', textEn: 'Arctic tundras' }
    ]
  },
  {
    id: 'quiz_water_ratio',
    questionPl: 'Ile kropel wody w aplikacji Watch4Trees pozwala na ufundowanie 1 posadzonego drzewa?',
    questionEn: 'How many water drops in Watch4Trees are needed to plant 1 real tree?',
    options: [
      { textPl: '10 kropel wody', textEn: '10 water drops', isCorrect: true },
      { textPl: '100 kropel wody', textEn: '100 water drops' },
      { textPl: '1 kropla wody', textEn: '1 water drop' },
      { textPl: '50 kropel wody', textEn: '50 water drops' }
    ]
  },
  {
    id: 'quiz_forest_biodiversity',
    questionPl: 'Jaki procent ziemskich lądowych gatunków zwierząt i roślin zamieszkuje lasy?',
    questionEn: 'What percentage of Earth\'s terrestrial animal and plant species live in forests?',
    options: [
      { textPl: 'Około 80% wszystkich gatunków lądowych', textEn: 'About 80% of all terrestrial species', isCorrect: true },
      { textPl: 'Mniej niż 10%', textEn: 'Less than 10%' },
      { textPl: 'Około 30%', textEn: 'Around 30%' },
      { textPl: '0% (gatunki żyją głównie w miastach)', textEn: '0% (species mostly live in cities)' }
    ]
  },
  {
    id: 'quiz_mangrove_superpower',
    questionPl: 'Dlaczego lasy namorzynowe (mangrowce) są tak cenne dla klimatu?',
    questionEn: 'Why are mangrove forests so vital for the global climate?',
    options: [
      { textPl: 'Magazynują do 4-5 razy więcej węgla niż lasy lądowe i chronią wybrzeża', textEn: 'They store up to 4-5x more carbon than terrestrial forests & protect coasts', isCorrect: true },
      { textPl: 'Nie mają żadnego znaczenia dla środowiska', textEn: 'They have no environmental significance' },
      { textPl: 'Powodują erozję wybrzeży', textEn: 'They cause coastal erosion' },
      { textPl: 'Rosną wyłącznie na pustyniach', textEn: 'They grow exclusively in deserts' }
    ]
  }
];

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function getRandomQuiz(): SanitizedQuiz {
  const randomIndex = Math.floor(Math.random() * QUIZ_POOL.length);
  const quiz = QUIZ_POOL[randomIndex];

  let correctOptionId = '';

  // Generate dynamic, unique IDs for options per session
  const dynamicOptions: QuizOption[] = quiz.options.map(opt => {
    const dynamicId = `opt_${crypto.randomUUID().slice(0, 8)}`;
    if (opt.isCorrect) {
      correctOptionId = dynamicId;
    }
    return {
      id: dynamicId,
      textPl: opt.textPl,
      textEn: opt.textEn
    };
  });

  return {
    id: quiz.id,
    questionPl: quiz.questionPl,
    questionEn: quiz.questionEn,
    options: shuffleArray(dynamicOptions),
    correctOptionId
  };
}

