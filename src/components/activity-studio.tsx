"use client";

/* eslint-disable @next/next/no-img-element -- generated PNG preview is intentionally served without optimization. */
import { FormEvent, useEffect, useMemo, useState } from "react";
import type {
  EditablePosterContent,
  EmployeeActivityInput,
  PosterDocument
} from "@/contracts/poster";

type Version = {
  assetMode: string;
  assetDetail?: string;
  outputFormat: string;
  templateVersion: string;
  promptVersion: string;
  illustrationPromptVersion: string;
  modelInfo: { copyProvider: string; imageProvider: string };
  validation: { passed: boolean; messages: string[] };
  posterDocument: { title: string; subtitle: string };
};

type Job = {
  id?: string;
  status: string;
  currentStep: string;
  error?: { code: string; message: string };
  previewUrl?: string;
  copyDraft?: {
    document: PosterDocument;
    provider: string;
    model: string;
    createdAt: string;
  };
  versions: Version[];
};

const initial: EmployeeActivityInput = {
  outputFormat: "portrait_1080x1920",
  activityName: "秋日同行日",
  category: "team",
  themeKeywords: [],
  description:
    "一场为同事准备的轻松秋日相聚，包含趣味互动、手作体验和下午茶。",
  sessions: [
    {
      label: "上海站",
      date: "2026-09-18",
      time: "14:00–17:30",
      location: "上海总部一层多功能厅",
      details: ["手作体验与下午茶"]
    }
  ],
  highlights: ["轻松互动", "限定手作", "下午茶时光"],
  participationSteps: ["点击活动链接完成报名", "按场次时间到达指定地点"],
  notice: "活动名额有限，请以现场安排为准。",
  includeQr: false,
  ctaLabel: "点击链接报名",
  qrPayload: "",
  contact: "行政服务台",
  visualIntent:
    "几位同事在秋日草坪上做手作并轻松互动，温暖但不要幼稚，上方留出标题空间。"
};

const scenes = [
  {
    id: "activity",
    icon: "✦",
    title: "员工活动",
    text: "节日、安全、差旅、竞赛与俱乐部活动",
    state: "当前切片"
  },
  {
    id: "benefit",
    icon: "♡",
    title: "员工福利",
    text: "下午茶、体验与周边权益",
    state: "后续"
  },
  {
    id: "notice",
    icon: "▣",
    title: "员工通知",
    text: "安全提醒、制度与温馨通知",
    state: "后续"
  },
  {
    id: "survey",
    icon: "◫",
    title: "调查问卷",
    text: "满意度、活动反馈与行政调研",
    state: "后续"
  }
];

const ideas = ["秋日草坪", "轻松互动", "手作体验", "明亮留白"];

export function ActivityStudio() {
  const [form, setForm] = useState<EmployeeActivityInput>(initial);
  const [jobId, setJobId] = useState<string>();
  const [job, setJob] = useState<Job>();
  const [copyContent, setCopyContent] = useState<EditablePosterContent>();
  const [loadedDraftKey, setLoadedDraftKey] = useState<string>();
  const [error, setError] = useState<string>();

  const completed = job?.status === "READY_FOR_REVIEW";
  const copyReady = job?.status === "READY_FOR_COPY_REVIEW";
  const failed = job?.status === "FAILED_FINAL";
  const working = Boolean(job && !completed && !copyReady && !failed);

  useEffect(() => {
    if (!jobId || completed || copyReady || failed) return;
    const timer = window.setInterval(async () => {
      const response = await fetch(`/api/jobs/${jobId}`, {
        cache: "no-store"
      });
      if (response.ok) setJob((await response.json()) as Job);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [jobId, completed, copyReady, failed]);

  useEffect(() => {
    const draft = job?.copyDraft;
    if (!draft || draft.createdAt === loadedDraftKey) return;
    setCopyContent({
      title: draft.document.title,
      subtitle: draft.document.subtitle,
      summary: draft.document.summary,
      highlights: draft.document.highlights,
      participationSteps: draft.document.participationSteps
    });
    setLoadedDraftKey(draft.createdAt);
  }, [job?.copyDraft, loadedDraftKey]);

  const setSession = (
    index: number,
    field: keyof EmployeeActivityInput["sessions"][number],
    value: string
  ) =>
    setForm((current) => ({
      ...current,
      sessions: current.sessions.map((session, itemIndex) =>
        itemIndex === index
          ? {
              ...session,
              [field]:
                field === "details"
                  ? value.split("\n").filter(Boolean)
                  : value
            }
          : session
      )
    }));

  const setList = (
    field: "highlights" | "participationSteps",
    value: string
  ) =>
    setForm((current) => ({
      ...current,
      [field]: value.split("\n").filter(Boolean)
    }));

  const addIdea = (idea: string) =>
    setForm((current) => ({
      ...current,
      visualIntent: current.visualIntent.includes(idea)
        ? current.visualIntent
        : `${current.visualIntent} ${idea}`.trim()
    }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(undefined);
    setJob(undefined);
    setCopyContent(undefined);
    setLoadedDraftKey(undefined);

    const response = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: form,
        idempotencyKey: crypto.randomUUID()
      })
    });
    const payload = (await response.json()) as {
      jobId?: string;
      error?: { message: string };
    };
    if (!response.ok || !payload.jobId) {
      setError(payload.error?.message ?? "创建任务失败");
      return;
    }
    setJobId(payload.jobId);
    setJob({
      id: payload.jobId,
      status: "QUEUED",
      currentStep: "正在创建文案任务",
      versions: []
    });
  }

  async function confirmCopy() {
    if (!jobId || !copyContent) return;
    setError(undefined);
    const response = await fetch(`/api/jobs/${jobId}/confirm-copy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: copyContent,
        idempotencyKey: crypto.randomUUID()
      })
    });
    const payload = (await response.json()) as {
      error?: { message: string };
    };
    if (!response.ok) {
      setError(payload.error?.message ?? "确认文案失败");
      return;
    }
    setJob((current) =>
      current
        ? {
            ...current,
            status: "GENERATING_ASSET",
            currentStep: "已确认文案，准备生成主视觉"
          }
        : current
    );
  }

  async function regenerateAsset() {
    if (!jobId) return;
    setError(undefined);
    const response = await fetch(`/api/jobs/${jobId}/regenerate-asset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idempotencyKey: crypto.randomUUID() })
    });
    const payload = (await response.json()) as {
      error?: { message: string };
    };
    if (!response.ok) {
      setError(payload.error?.message ?? "重新生成主视觉失败");
      return;
    }
    setJob((current) =>
      current
        ? {
            ...current,
            status: "GENERATING_ASSET",
            currentStep: "仅重新生成主视觉"
          }
        : current
    );
  }

  const status = useMemo(() => {
    if (completed) return "海报已生成";
    if (copyReady) return "文案待确认";
    if (failed) return "任务未完成";
    return job?.currentStep ?? "输入完成后先生成文案";
  }, [completed, copyReady, failed, job]);

  const version = job?.versions.at(-1);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark">
          <span>✦</span>
          <b>行政智绘</b>
        </div>
        <nav>
          <a className="nav-item active" href="#create">
            <span>＋</span>新建海报
          </a>
          <a className="nav-item" href="#history">
            <span>◷</span>生成记录
          </a>
          <a className="nav-item" href="#assets">
            <span>▧</span>品牌资产
          </a>
        </nav>
        <div className="account">
          <i>九</i>
          <span>
            本地演示<small>员工活动单切片</small>
          </span>
        </div>
      </aside>

      <main className="workspace" id="create">
        <header className="topbar">
          <div>
            <b>新建海报</b>
            <span> / 员工活动</span>
          </div>
          <p>模板 v1.6 · 竖版 1080 × 1920</p>
        </header>

        <div className="content-grid">
          <form onSubmit={submit}>
            <section className="section-block">
              <div className="section-heading">
                <h1>选择场景</h1>
                <p>当前只开放一个员工活动切片，其余场景暂不扩展。</p>
              </div>
              <div className="scene-grid">
                {scenes.map((scene) => (
                  <button
                    type="button"
                    className={`scene-card ${
                      scene.id === "activity" ? "selected" : ""
                    }`}
                    key={scene.id}
                    disabled={scene.id !== "activity"}
                  >
                    <i>{scene.icon}</i>
                    <span>
                      <b>{scene.title}</b>
                      <small>{scene.text}</small>
                    </span>
                    <em>{scene.state}</em>
                  </button>
                ))}
              </div>
            </section>

            <section className="section-block">
              <Section
                title="输出规格"
                text="当前切片固定为竖版；其他 Format 等正式模板体系确认后再接入。"
              >
                <div className="format-card">
                  <b>竖版海报</b>
                  <span>1080 × 1920 px</span>
                  <em>已锁定</em>
                </div>
              </Section>
            </section>

            <section className="section-block">
              <Section
                title="基本信息"
                text="活动名称与简介会进入受控文案生成。"
              >
                <div className="form-grid">
                  <Field
                    label="活动名称"
                    value={form.activityName}
                    onChange={(value) =>
                      setForm({ ...form, activityName: value })
                    }
                  />
                  <label>
                    活动类型
                    <select
                      value={form.category}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          category: event.target
                            .value as EmployeeActivityInput["category"]
                        })
                      }
                    >
                      <option value="team">团队活动</option>
                      <option value="festival">节日主题</option>
                      <option value="competition">竞赛活动</option>
                    </select>
                  </label>
                  <TextField
                    label="活动简介"
                    value={form.description}
                    onChange={(value) =>
                      setForm({ ...form, description: value })
                    }
                  />
                </div>
              </Section>
            </section>

            <section className="section-block">
              <Section
                title="场次与地点"
                text="最多添加两个场次；日期、时间和地点会被逐字段锁定。"
              >
                {form.sessions.map((session, index) => (
                  <div className="session-form" key={index}>
                    <div className="session-title">
                      <b>{index === 0 ? "第一场" : "第二场"}</b>
                      {index === 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setForm({
                              ...form,
                              sessions: form.sessions.slice(0, 1)
                            })
                          }
                        >
                          移除
                        </button>
                      )}
                    </div>
                    <div className="form-grid">
                      <Field
                        label="场次名称"
                        value={session.label}
                        onChange={(value) =>
                          setSession(index, "label", value)
                        }
                      />
                      <Field
                        label="日期"
                        value={session.date}
                        onChange={(value) =>
                          setSession(index, "date", value)
                        }
                      />
                      <Field
                        label="时间"
                        value={session.time}
                        onChange={(value) =>
                          setSession(index, "time", value)
                        }
                      />
                      <Field
                        label="地点"
                        value={session.location}
                        onChange={(value) =>
                          setSession(index, "location", value)
                        }
                      />
                      <TextField
                        label="补充说明（每行一条，最多三条）"
                        value={session.details.join("\n")}
                        onChange={(value) =>
                          setSession(index, "details", value)
                        }
                      />
                    </div>
                  </div>
                ))}
                {form.sessions.length < 2 && (
                  <button
                    className="add-row"
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        sessions: [
                          ...form.sessions,
                          {
                            label: "",
                            date: "",
                            time: "",
                            location: "",
                            details: []
                          }
                        ]
                      })
                    }
                  >
                    ＋ 添加第二场
                  </button>
                )}
              </Section>
            </section>

            <section className="section-block">
              <Section
                title="亮点与参与方式"
                text="每行填写一项，AI 可以优化措辞，但不会修改活动事实。"
              >
                <div className="form-grid">
                  <TextField
                    label="活动亮点（2–4 条）"
                    value={form.highlights.join("\n")}
                    onChange={(value) => setList("highlights", value)}
                  />
                  <TextField
                    label="参与方式（1–4 条）"
                    value={form.participationSteps.join("\n")}
                    onChange={(value) =>
                      setList("participationSteps", value)
                    }
                  />
                </div>
              </Section>
            </section>

            <section className="section-block">
              <Section
                title="提示与行动"
                text="二维码为可选内容；启用后只允许替换链接，位置由模板锁定。"
              >
                <div className="form-grid">
                  <TextField
                    label="注意事项"
                    value={form.notice}
                    onChange={(value) => setForm({ ...form, notice: value })}
                  />
                  <Field
                    label="行动文案（可选）"
                    value={form.ctaLabel}
                    onChange={(value) =>
                      setForm({ ...form, ctaLabel: value })
                    }
                  />
                  <Field
                    label="联系人或咨询渠道（可选）"
                    value={form.contact}
                    onChange={(value) =>
                      setForm({ ...form, contact: value })
                    }
                  />
                  <label className="check-row full">
                    <input
                      type="checkbox"
                      checked={form.includeQr}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          includeQr: event.target.checked,
                          qrPayload: event.target.checked ? form.qrPayload : ""
                        })
                      }
                    />
                    <span>
                      <b>需要二维码</b>
                      <small>启用后填写确定性链接</small>
                    </span>
                  </label>
                  {form.includeQr && (
                    <Field
                      label="二维码链接"
                      value={form.qrPayload}
                      onChange={(value) =>
                        setForm({ ...form, qrPayload: value })
                      }
                    />
                  )}
                </div>
              </Section>
            </section>

            <section className="section-block visual-block">
              <Section
                title="主视觉描述"
                text="只描述主体、动作、环境和感觉，不填写内部地点、Logo、二维码或正文。"
              >
                <TextField
                  label="一句话描述"
                  value={form.visualIntent}
                  onChange={(value) =>
                    setForm({ ...form, visualIntent: value })
                  }
                />
                <div className="ideas">
                  {ideas.map((idea) => (
                    <button
                      type="button"
                      key={idea}
                      onClick={() => addIdea(idea)}
                    >
                      ＋ {idea}
                    </button>
                  ))}
                </div>
                <div className="compiler-summary">
                  <span>系统将生成</span>
                  <p>
                    主体：同事活动 · 构图：标题安全区 ·
                    风格：等待正式模板后最终校准
                  </p>
                </div>
              </Section>
            </section>

            {copyReady && copyContent && (
              <section className="section-block copy-review">
                <Section
                  title="确认 AI 文案"
                  text="确认后才会调用图片模型。日期、时间、地点和二维码配置不会在此处修改。"
                >
                  <div className="stage-banner">
                    <b>第一阶段已完成</b>
                    <span>
                      {job?.copyDraft?.provider} · {job?.copyDraft?.model}
                    </span>
                  </div>
                  <div className="form-grid">
                    <Field
                      label="标题"
                      value={copyContent.title}
                      onChange={(value) =>
                        setCopyContent({ ...copyContent, title: value })
                      }
                    />
                    <Field
                      label="副标题"
                      value={copyContent.subtitle}
                      onChange={(value) =>
                        setCopyContent({ ...copyContent, subtitle: value })
                      }
                    />
                    <TextField
                      label="摘要"
                      value={copyContent.summary}
                      onChange={(value) =>
                        setCopyContent({ ...copyContent, summary: value })
                      }
                    />
                    <TextField
                      label="活动亮点（2–4 条）"
                      value={copyContent.highlights.join("\n")}
                      onChange={(value) =>
                        setCopyContent({
                          ...copyContent,
                          highlights: value.split("\n").filter(Boolean)
                        })
                      }
                    />
                    <TextField
                      label="参与方式（1–4 条）"
                      value={copyContent.participationSteps.join("\n")}
                      onChange={(value) =>
                        setCopyContent({
                          ...copyContent,
                          participationSteps: value
                            .split("\n")
                            .filter(Boolean)
                        })
                      }
                    />
                  </div>
                  <div className="review-actions">
                    <button
                      className="generate"
                      type="button"
                      onClick={confirmCopy}
                    >
                      确认文案并生成视觉
                    </button>
                  </div>
                </Section>
              </section>
            )}

            {error && <p className="form-error">{error}</p>}
            {job?.error && (
              <p className="form-error">
                {job.error.message}（{job.error.code}）
              </p>
            )}

            <div className="submit-row">
              <p>
                首次提交只调用文案模型；确认文案后才调用图片模型并产生生图费用。
              </p>
              <button className="generate" disabled={working || copyReady}>
                {working
                  ? "正在处理…"
                  : copyReady
                    ? "请先确认文案"
                    : completed
                      ? "创建新任务"
                      : "生成并检查文案"}
              </button>
            </div>
          </form>

          <aside className="preview-panel">
            <div className="preview-head">
              <div>
                <p>任务状态</p>
                <h2>{status}</h2>
              </div>
              <span className={completed ? "ready" : ""}>
                {completed ? "已就绪" : copyReady ? "待确认" : "处理中"}
              </span>
            </div>
            <div className="poster-wrap">
              {completed && job?.previewUrl ? (
                <img src={job.previewUrl} alt="生成的员工活动海报" />
              ) : (
                <Preview
                  poster={form}
                  draft={job?.copyDraft?.document}
                />
              )}
            </div>
            {completed && job?.previewUrl && (
              <div className="result-actions">
                <a
                  className="download"
                  href={job.previewUrl}
                  download="employee-activity-v1-6.png"
                >
                  下载 PNG
                </a>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={regenerateAsset}
                >
                  只换主视觉
                </button>
              </div>
            )}
            <div className="preview-note">
              {version ? (
                <>
                  <b>
                    {version.assetMode === "fallback"
                      ? "默认资产降级"
                      : "真实生成主视觉"}
                  </b>
                  <span>
                    模型：{version.modelInfo.copyProvider} ·{" "}
                    {version.modelInfo.imageProvider} · 模板{" "}
                    {version.templateVersion}
                  </span>
                  <span>Format：{version.outputFormat}</span>
                  {version.validation.messages.map((message) => (
                    <small key={message}>{message}</small>
                  ))}
                </>
              ) : (
                <>
                  <b>两阶段生成</b>
                  <span>
                    先确认结构化文案，再生成主视觉和最终 PNG
                  </span>
                </>
              )}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

function Section({
  title,
  text,
  children
}: {
  title: string;
  text: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="section-heading">
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
      <div className="section-content">{children}</div>
    </>
  );
}

function Field({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function TextField({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="full">
      {label}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function Preview({
  poster,
  draft
}: {
  poster: EmployeeActivityInput;
  draft?: PosterDocument;
}) {
  return (
    <div className="draft-poster">
      <div className="draft-brand">✦ NINEBOT</div>
      <div className="draft-hero">
        <span>
          {poster.category === "team"
            ? "团队活动"
            : poster.category === "festival"
              ? "节日主题"
              : "竞赛活动"}
        </span>
        <h3>{draft?.title ?? poster.activityName}</h3>
        <p>{draft?.summary ?? poster.description}</p>
        <i>{draft ? "文案已生成 · 待确认" : "主视觉安全区"}</i>
      </div>
      <div className="draft-info">
        {poster.sessions.map((session) => (
          <div key={session.label || session.location}>
            <b>{session.label || "场次名称"}</b>
            <span>
              {session.date || "日期"} · {session.time || "时间"}
            </span>
            <small>{session.location || "地点"}</small>
          </div>
        ))}
      </div>
      <div className="draft-tags">
        {(draft?.highlights ?? poster.highlights).map((highlight) => (
          <span key={highlight}>{highlight}</span>
        ))}
      </div>
      <p className="draft-notice">{poster.notice}</p>
      <footer>NINEBOT · 行政智绘</footer>
    </div>
  );
}
