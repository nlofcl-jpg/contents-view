import { useLocation } from "wouter";
import { Play, TrendingUp, Users, Sparkles } from "lucide-react";

interface ServiceCard {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  subtitle: string;
  href: string;
}

export default function ServiceCards() {
  const [, setLocation] = useLocation();

  const cards: ServiceCard[] = [
    {
      id: "youtube",
      icon: <Play className="w-8 h-8" />,
      title: "YouTube 트렌드",
      description: "국가별, 카테고리별 YouTube 콘텐츠 트렌드를 확인하세요.",
      subtitle: "인기 영상, 채널, 쇼츠 흐름을 한눈에 볼 수 있습니다.",
      href: "/trends/youtube",
    },
    {
      id: "naver",
      icon: <TrendingUp className="w-8 h-8" />,
      title: "쇼핑 트렌드",
      description: "검색 트렌드와 쇼틱 클릭률 흐름을 비교해보세요.",
      subtitle: "키워드별 관심도 변화를 기간별로 확인할 수 있습니다.",
      href: "/trends/naver",
    },
    {
      id: "community",
      icon: <Users className="w-8 h-8" />,
      title: "커뮤니티 트렌드",
      description: "주요 커뮤니티 인기글 흐름을 한눈에 확인하세요.",
      subtitle: "디시인사이드, 뽐뿌, 네이트판, 루리웹, 인벤 인기글을 모아볼 수 있습니다.",
      href: "/community",
    },
    {
      id: "ai-studio",
      icon: <Sparkles className="w-8 h-8" />,
      title: "AI 스튜디오",
      description: "콘텐츠 제작에 필요한 AI 도구를 한곳에서 제작해보세요.",
      subtitle: "AI 글쓰기, 썸네일, 영상 제작 기능을 한곳에서 제작할 수 있습니다.",
      href: "/ai-studio",
    },
  ];

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 bg-transparent">
      <div className="max-w-7xl mx-auto">
        {/* Section Title and Subtitle */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-white mb-3">
            크리에이터 트렌드 레이더
          </h2>
          <p className="text-gray-400 text-base">
            유튜브·네이버·커뮤니티 데이터로 콘텐츠 아이디어를 빠르게 찾아보세요.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {cards.map((card) => (
            <button
              key={card.id}
              onClick={() => setLocation(card.href)}
              className="group relative p-6 rounded-lg border border-blue-500/20 bg-slate-900/50 hover:border-blue-400/40 hover:bg-slate-900/70 transition-all duration-200 text-left cursor-pointer"
            >
              {/* Icon */}
              <div className="mb-4 inline-flex p-3 rounded-lg bg-blue-500/15 text-blue-400 group-hover:bg-blue-500/25 transition-colors">
                {card.icon}
              </div>

              {/* Title */}
              <h3 className="text-lg font-semibold text-white mb-2">
                {card.title}
              </h3>

              {/* Description */}
              <p className="text-sm text-gray-300 mb-3">
                {card.description}
              </p>

              {/* Subtitle */}
              <p className="text-xs text-gray-400 mb-4">
                {card.subtitle}
              </p>

              {/* Arrow */}
              <div className="inline-flex items-center text-blue-400 text-sm font-medium group-hover:translate-x-1 transition-transform">
                바로가기
                <span className="ml-2">→</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
