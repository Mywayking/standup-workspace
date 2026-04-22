"use client";
import { useWorkflow, type WorkflowCard, type CardType } from "./WorkflowContext";

const CARD_TYPE_LABELS: Record<CardType, string> = {
  source: "原始素材",
  premise: "前提提炼",
  angles: "角度分析",
  rewrite: "改稿结果",
  joke_to_premise: "梗写前提",
};

const CARD_TYPE_ICONS: Record<CardType, string> = {
  source: "📝",
  premise: "💡",
  angles: "🔍",
  rewrite: "✏️",
  joke_to_premise: "🎯",
};

function CardItem({ card, onResume }: { card: WorkflowCard; onResume: () => void }) {
  const { addCard } = useWorkflow();

  const handleSendToAngles = () => {
    addCard({
      type: "angles",
      title: card.type === "premise" ? card.content.slice(0, 30) + "…" : "角度分析",
      content: card.content,
      rawData: card.rawData,
      status: "success",
      sourceStep: CARD_TYPE_LABELS[card.type],
    });
  };

  const handleSendToRewrite = () => {
    addCard({
      type: "rewrite",
      title: card.type === "angles" ? card.content.slice(0, 30) + "…" : "改稿",
      content: card.content,
      rawData: card.rawData,
      status: "success",
      sourceStep: CARD_TYPE_LABELS[card.type],
    });
  };

  return (
    <div className="p-3 bg-white rounded-xl border border-gray-100 hover:border-blue-200 transition-colors">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-sm">{CARD_TYPE_ICONS[card.type]}</span>
        <span className="text-xs font-medium text-gray-500">{CARD_TYPE_LABELS[card.type]}</span>
        {card.sourceStep && (
          <span className="text-xs text-gray-300 ml-auto">← {card.sourceStep}</span>
        )}
      </div>

      <p className="text-sm text-gray-800 line-clamp-3 leading-relaxed">
        {card.content.slice(0, 100)}{card.content.length > 100 ? "…" : ""}
      </p>

      {/* 主操作按钮 */}
      <div className="flex flex-wrap gap-1.5 mt-2">
        <button
          onClick={onResume}
          className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors font-medium"
        >
          继续使用
        </button>

        {/* 前提 → 找角度 */}
        {card.type === "premise" && (
          <button
            onClick={handleSendToAngles}
            className="text-xs px-2 py-1 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors"
          >
            🔍 找角度
          </button>
        )}

        {/* 角度 → 改稿 */}
        {card.type === "angles" && (
          <button
            onClick={handleSendToRewrite}
            className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
          >
            ✏️ 改稿
          </button>
        )}

        {/* 梗写前提 → 找角度 */}
        {card.type === "joke_to_premise" && (
          <button
            onClick={handleSendToAngles}
            className="text-xs px-2 py-1 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors"
          >
            🔍 找角度
          </button>
        )}
      </div>
    </div>
  );
}

export default function WorkflowSessionPanel() {
  const { session, resumeFromCard, resetSession } = useWorkflow();

  if (!session) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-bold text-gray-800">当前创作会话</p>
          <p className="text-xs text-gray-400">{session.cards.length} 个结果</p>
        </div>
        <button
          onClick={resetSession}
          className="text-xs text-gray-400 hover:text-red-500 transition-colors"
        >
          结束会话
        </button>
      </div>

      {/* Source */}
      <div className="mb-3 p-2.5 bg-gray-50 rounded-xl border border-gray-100">
        <p className="text-xs text-gray-400 font-medium mb-1">原始素材</p>
        <p className="text-xs text-gray-600 line-clamp-2">{session.sourceInput}</p>
      </div>

      {/* Cards */}
      {session.cards.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">
          开始创作后结果会显示在这里
        </p>
      ) : (
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {session.cards.map((card) => (
            <CardItem
              key={card.id}
              card={card}
              onResume={() => resumeFromCard(card.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
