import type { TopicConfig, Deck } from '@/types/quiz';

export const DEFAULT_TOPICS: Record<string, TopicConfig> = {
  all: {
    id: 'all',
    name: 'Tất cả',
    icon: '✨',
    badgeText: 'Không gian Học tập Đa năng',
    titlePrefix: 'Ôn luyện',
    titleHighlight: 'Tổng hợp',
    description: 'Bao quát toàn bộ câu hỏi trắc nghiệm, ngoại ngữ và bộ đề thực chiến.',
    colorGradient: 'from-blue-600 via-indigo-600 to-sky-500 dark:from-blue-400 dark:via-indigo-300 dark:to-cyan-400',
  },
  fast_track: {
    id: 'fast_track',
    name: 'Fast Track',
    icon: '⚡',
    badgeText: 'Fast Track Mode',
    titlePrefix: 'Luyện thi',
    titleHighlight: 'Fast Track',
    description: 'Ôn luyện trắc nghiệm song ngữ Anh - Việt và thi thử bấm giờ chuẩn cấu trúc.',
    colorGradient: 'from-blue-600 via-indigo-600 to-sky-500 dark:from-blue-400 dark:via-indigo-300 dark:to-cyan-400',
  },
  japanese: {
    id: 'japanese',
    name: 'Tiếng Nhật',
    icon: '🇯🇵',
    badgeText: 'JLPT N5 – N1',
    titlePrefix: 'Luyện thi',
    titleHighlight: 'Tiếng Nhật',
    description: 'Ghi nhớ Hán tự Kanji, từ vựng và ngữ pháp theo phản xạ ngắt quãng.',
    colorGradient: 'from-rose-600 via-red-600 to-amber-500 dark:from-rose-400 dark:via-red-300 dark:to-amber-400',
  },
  english: {
    id: 'english',
    name: 'Tiếng Anh',
    icon: '🇬🇧',
    badgeText: 'TOEIC & IELTS',
    titlePrefix: 'Luyện thi',
    titleHighlight: 'Tiếng Anh',
    description: 'Phát triển vốn từ vựng học thuật, ngữ pháp và rèn luyện phản xạ ngôn ngữ.',
    colorGradient: 'from-emerald-600 via-teal-600 to-cyan-500 dark:from-emerald-400 dark:via-teal-300 dark:to-cyan-400',
  },
};

/**
 * Returns configuration for a topic ID, automatically generating
 * a consistent style for any custom user-added topic.
 */
export function getTopicConfig(topicId: string, customName?: string): TopicConfig {
  if (DEFAULT_TOPICS[topicId]) {
    return DEFAULT_TOPICS[topicId];
  }

  // Generate pleasant fallback for dynamic custom topics
  const formattedName = customName || topicId.charAt(0).toUpperCase() + topicId.slice(1).replace(/_/g, ' ');
  return {
    id: topicId,
    name: formattedName,
    icon: '📚',
    badgeText: `Chủ đề ${formattedName}`,
    titlePrefix: 'Ôn tập',
    titleHighlight: formattedName,
    description: `Ôn luyện các bộ đề và câu hỏi thuộc chuyên môn ${formattedName}.`,
    colorGradient: 'from-violet-600 via-purple-600 to-indigo-500 dark:from-violet-400 dark:via-purple-300 dark:to-indigo-400',
  };
}

/**
 * Resolve topic ID for a deck, falling back to 'fast_track' if none specified.
 */
export function resolveDeckTopic(deck: Deck): string {
  if (deck.category_id && deck.category_id.trim() !== '') {
    return deck.category_id.trim().toLowerCase();
  }
  
  // Intelligent auto-detection if category_id not explicitly set
  const titleLower = deck.title.toLowerCase();
  const sourceLower = (deck.source || '').toLowerCase();
  if (titleLower.includes('nhật') || titleLower.includes('jlpt') || sourceLower.includes('japanese')) {
    return 'japanese';
  }
  if (titleLower.includes('toeic') || titleLower.includes('ielts') || titleLower.includes('english') || sourceLower.includes('english')) {
    return 'english';
  }
  return 'fast_track';
}

/**
 * Discovers all unique topics present across loaded decks
 * and returns them in a sensible priority order (All, Fast Track, Japanese, English, custom...)
 */
export function getAvailableTopics(decks: Deck[]): TopicConfig[] {
  const topicsMap = new Map<string, TopicConfig>();
  
  // Always include 'all'
  topicsMap.set('all', DEFAULT_TOPICS.all);

  // If there are standard topics, make sure they are included or present if they have decks
  const presentCategoryIds = new Set<string>();
  decks.forEach((d) => {
    presentCategoryIds.add(resolveDeckTopic(d));
  });

  // Ensure default main categories always exist in the tab bar for intuitive UX
  ['fast_track', 'japanese', 'english'].forEach((catId) => {
    topicsMap.set(catId, getTopicConfig(catId));
  });

  // Add any custom topics created by user
  presentCategoryIds.forEach((catId) => {
    if (!topicsMap.has(catId)) {
      topicsMap.set(catId, getTopicConfig(catId));
    }
  });

  return Array.from(topicsMap.values());
}

