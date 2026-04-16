"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { Toolbar } from "@/components/layout/Toolbar";
import { LeftPanel } from "@/components/layout/LeftPanel";
import { CenterPanel } from "@/components/layout/CenterPanel";
import { RightPanel } from "@/components/layout/RightPanel";
import type { Analysis, AnalysisJob, Script } from "@/types";

// nginx proxies /api → backend
const BASE = "";

async function apiJson<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`);
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json() as Promise<T>;
}

async function apiVoid(path: string, opts?: RequestInit) {
  const r = await fetch(`${BASE}${path}`, opts);
  if (!r.ok) throw new Error(`${r.status}`);
}

export default function WorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const scriptId = Number(params.id);

  const {
    analysis,
    setAnalysis,
    selectedSegmentId,
    selectSegment,
    currentJob,
    setCurrentJob,
    filterKeyword,
  } = useWorkspaceStore();

  const [starredOnly, setStarredOnly] = useState(false);
  const [showMetaModal, setShowMetaModal] = useState(false);
  const [metaForm, setMetaForm] = useState({ actor_name: "", show_name: "", title: "" });
  const [allScripts, setAllScripts] = useState<Script[]>([]);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const prevJobStatusRef = useRef<string | undefined>(undefined);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load analysis
  const loadAnalysis = useCallback(async () => {
    try {
      const data = await apiJson<Analysis>(`/api/scripts/${scriptId}/analysis`);
      setAnalysis(data);
      setMetaForm({
        actor_name: data.actor_name || "",
        show_name: data.show_name || "",
        title: data.title || "",
      });
    } catch (e) {
      console.error("Failed to load analysis:", e);
    }
  }, [scriptId, setAnalysis]);

  // Load all scripts for navigation
  const loadScripts = useCallback(async () => {
    try {
      const scripts = await apiJson<Script[]>("/api/scripts");
      setAllScripts(scripts);
    } catch {}
  }, []);

  useEffect(() => {
    if (!scriptId || isNaN(scriptId)) return;
    loadAnalysis();
    loadScripts();
    setCurrentJob(null);
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, [scriptId]);

  // Poll job
  const pollJob = useCallback(
    (job: AnalysisJob) => {
      pollTimer.current = setTimeout(async () => {
        try {
          const updated = await apiJson<AnalysisJob>(`/api/jobs/${job.id}`);
          setCurrentJob(updated);
          if (updated.status === "completed") {
            await loadAnalysis();
          } else if (updated.status === "failed") {
            // stop
          } else {
            pollJob(updated); // recurse
          }
        } catch {
          pollJob(job); // retry
        }
      }, 2000);
    },
    [loadAnalysis, setCurrentJob],
  );

  // Watch for job completion → show snackbar
  useEffect(() => {
    const status = currentJob?.status;
    if (prevJobStatusRef.current === "running" && status === "completed") {
      const failed = currentJob?.message?.includes("失败") ? "（部分段落失败）" : "";
      setSnackbar(`✅ 分析完成${failed}`);
      setTimeout(() => setSnackbar(null), 4000);
    }
    prevJobStatusRef.current = status;
  }, [currentJob?.status, currentJob?.message]);

  const handleAnalyze = useCallback(async () => {
    if (currentJob?.status === "running" || currentJob?.status === "pending") return;
    try {
      const job = await apiJson<AnalysisJob>(`/api/scripts/${scriptId}/analyze`);
      setCurrentJob(job);
      pollJob(job);
    } catch (e) {
      alert("启动分析失败: " + e);
    }
  }, [scriptId, currentJob, pollJob, setCurrentJob]);

  const handleDelete = useCallback(async () => {
    if (!confirm("确定删除这篇文稿吗？")) return;
    try {
      await apiVoid(`/api/scripts/${scriptId}`, { method: "DELETE" });
      router.push("/");
    } catch (e) {
      alert("删除失败: " + e);
    }
  }, [scriptId, router]);

  const handleSaveMeta = useCallback(async () => {
    // Find the script record and patch it
    // The API doesn't have a patch for script metadata,
    // so we store it in the analysis (actor_name etc are part of analysis)
    // For now just close the modal - actual metadata comes from analysis
    setShowMetaModal(false);
    // Reload to reflect
    await loadAnalysis();
  }, [loadAnalysis]);

  const handleToggleStar = useCallback(
    async (segmentId: number, starred: boolean) => {
      try {
        await fetch(`${BASE}/api/segments/${segmentId}/star?starred=${starred}`, {
          method: "PATCH",
        });
        if (analysis) {
          const segments = analysis.segments.map((s) =>
            s.id === segmentId ? { ...s, starred } : s,
          );
          setAnalysis({
            ...analysis,
            segments,
            starred_count: segments.filter((s) => s.starred).length,
          });
        }
      } catch (e) {
        console.error("Star toggle failed:", e);
      }
    },
    [analysis, setAnalysis],
  );

  // Prev / Next script
  const currentIndex = allScripts.findIndex((s) => s.id === scriptId);
  const prevScript = currentIndex > 0 ? allScripts[currentIndex - 1] : null;
  const nextScript = currentIndex < allScripts.length - 1 ? allScripts[currentIndex + 1] : null;

  const selectedSegment =
    analysis?.segments.find((s) => s.id === selectedSegmentId) ?? null;

  useEffect(() => {
    if (!selectedSegmentId && analysis?.segments.length) {
      selectSegment(analysis.segments[0].id);
    }
  }, [analysis, selectedSegmentId, selectSegment]);

  if (!analysis) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Toolbar scriptId={scriptId} onDelete={handleDelete} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-400 text-sm">加载中...</p>
            <button
              onClick={() => router.push("/")}
              className="mt-2 text-xs text-blue-500 hover:underline"
            >
              返回首页
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Toolbar
        scriptId={scriptId}
        onAnalyze={handleAnalyze}
        onDelete={handleDelete}
        onEditMeta={() => setShowMetaModal(true)}
        segmentCount={analysis.segments?.length ?? 0}
        jobProgress={currentJob?.progress}
        jobMessage={currentJob?.message}
        jobStatus={currentJob?.status}
        currentStep={currentJob?.step}
        stepName={currentJob?.step_name}
        onPrevScript={prevScript ? () => router.push(`/workspace/${prevScript.id}`) : undefined}
        onNextScript={nextScript ? () => router.push(`/workspace/${nextScript.id}`) : undefined}
      />

      {/* Snackbar notification */}
      {snackbar && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-800 text-white text-sm px-5 py-2.5 rounded-full shadow-xl animate-fade-in">
          {snackbar}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <LeftPanel
          segments={analysis.segments}
          selectedSegmentId={selectedSegmentId}
          onSelectSegment={selectSegment}
          starredOnly={starredOnly}
          onToggleStarredOnly={setStarredOnly}
        />

        <CenterPanel
          segments={analysis.segments}
          selectedSegmentId={selectedSegmentId}
          onSelectSegment={selectSegment}
          onToggleStar={handleToggleStar}
        />

        <RightPanel
          segment={selectedSegment}
          report={analysis.report}
          actorName={analysis.actor_name}
          showName={analysis.show_name}
          title={analysis.title}
        />
      </div>

      {/* Edit metadata modal */}
      {showMetaModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-96 shadow-xl">
            <h3 className="text-sm font-semibold mb-4">编辑文稿信息</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">标题</label>
                <input
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={metaForm.title}
                  onChange={(e) => setMetaForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="文稿标题"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">演员</label>
                <input
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={metaForm.actor_name}
                  onChange={(e) => setMetaForm((f) => ({ ...f, actor_name: e.target.value }))}
                  placeholder="演员名称"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">节目</label>
                <input
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={metaForm.show_name}
                  onChange={(e) => setMetaForm((f) => ({ ...f, show_name: e.target.value }))}
                  placeholder="节目/专场名称"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleSaveMeta}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md"
              >
                保存
              </button>
              <button
                onClick={() => setShowMetaModal(false)}
                className="px-4 py-2 text-sm text-gray-500"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
