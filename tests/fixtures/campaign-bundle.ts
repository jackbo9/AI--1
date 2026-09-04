import type { RenderTargetId } from "@/contracts/brand";
import {
  campaignBriefFromLegacyInput,
  confirmedCampaignDocumentSchema,
  employeeActivityInputSchema,
  type CampaignBrief,
  type ConfirmedCampaignDocument
} from "@/contracts/poster";
import normalInput from "./employee-activity.normal.json";

type BrandCheckExpectation = {
  passed: boolean;
  errors: string[];
  warnings: string[];
};

type FixedArtifactExpectation = {
  width: number;
  heightMode: "fixed";
  height: number;
  brandCheck: BrandCheckExpectation;
};

type AutoArtifactExpectation = {
  width: number;
  heightMode: "auto";
  minHeight: number;
  maxHeight: number;
  brandCheck: BrandCheckExpectation;
};

export type CampaignBundleFixture = {
  id:
    | "normal"
    | "two-sessions"
    | "competition"
    | "title-three-lines"
    | "title-overflow"
    | "missing-optional"
    | "with-qr"
    | "long-copy"
    | "image-fallback";
  campaignBrief: CampaignBrief;
  confirmedDocument: ConfirmedCampaignDocument;
  visualMode: "generated" | "fallback";
  expectedArtifacts: Record<
    RenderTargetId,
    FixedArtifactExpectation | AutoArtifactExpectation
  >;
};

const baseBrief = campaignBriefFromLegacyInput(
  employeeActivityInputSchema.parse(normalInput)
);

const baseDocument = confirmedCampaignDocumentSchema.parse({
  schemaVersion: "1.1",
  scene: "employee_activity",
  locale: "zh-CN",
  brandSpecVersion: 1,
  documentVersionId: "0583cdb7-6483-447d-bba7-3be8e7318332",
  sourceCopySchemaVersion: "1.7",
  category: baseBrief.category,
  title: "秋日同行日",
  subtitle: "一起出发，把日常过得更有意思",
  summary: baseBrief.description,
  sessions: baseBrief.sessions,
  audience: baseBrief.audience,
  highlights: baseBrief.highlights,
  participationSteps: baseBrief.participationSteps,
  notice: baseBrief.notice,
  includeQr: baseBrief.includeQr,
  ctaLabel: baseBrief.ctaLabel,
  qrPayload: baseBrief.qrPayload,
  contact: baseBrief.contact
});

const pass = (): BrandCheckExpectation => ({
  passed: true,
  errors: [],
  warnings: []
});

const fail = (...errors: string[]): BrandCheckExpectation => ({
  passed: false,
  errors,
  warnings: []
});

function expectedArtifacts(input?: {
  portrait?: BrandCheckExpectation;
  landscape?: BrandCheckExpectation;
  banner?: BrandCheckExpectation;
  longform?: BrandCheckExpectation;
  longformHeight?: [number, number];
}) {
  const longformHeight = input?.longformHeight ?? [2400, 3800];
  return {
    portrait_1080x1920: {
      width: 1080,
      heightMode: "fixed" as const,
      height: 1920,
      brandCheck: input?.portrait ?? pass()
    },
    landscape_1920x1080: {
      width: 1920,
      heightMode: "fixed" as const,
      height: 1080,
      brandCheck: input?.landscape ?? pass()
    },
    banner_2227x950: {
      width: 2227,
      heightMode: "fixed" as const,
      height: 950,
      brandCheck: input?.banner ?? pass()
    },
    longform_1080xAuto: {
      width: 1080,
      heightMode: "auto" as const,
      minHeight: longformHeight[0],
      maxHeight: longformHeight[1],
      brandCheck: input?.longform ?? pass()
    }
  };
}

function document(
  id: string,
  patch: Partial<ConfirmedCampaignDocument>
): ConfirmedCampaignDocument {
  return confirmedCampaignDocumentSchema.parse({
    ...baseDocument,
    ...patch,
    documentVersionId: id
  });
}

export const campaignBundleFixtures: CampaignBundleFixture[] = [
  {
    id: "normal",
    campaignBrief: baseBrief,
    confirmedDocument: baseDocument,
    visualMode: "generated",
    expectedArtifacts: expectedArtifacts()
  },
  {
    id: "two-sessions",
    campaignBrief: {
      ...baseBrief,
      sessions: [
        ...baseBrief.sessions,
        {
          label: "常州站",
          date: "2026-09-20",
          time: "14:00–17:30",
          location: "常州制造基地共享空间",
          details: []
        }
      ]
    },
    confirmedDocument: document(
      "525d55bf-471c-4219-8d3c-01998da30b1d",
      {
        sessions: [
          ...baseBrief.sessions,
          {
            label: "常州站",
            date: "2026-09-20",
            time: "14:00–17:30",
            location: "常州制造基地共享空间",
            details: []
          }
        ]
      }
    ),
    visualMode: "generated",
    expectedArtifacts: expectedArtifacts()
  },
  {
    id: "competition",
    campaignBrief: { ...baseBrief, category: "competition" },
    confirmedDocument: document(
      "49b8eff7-1a2e-4f85-a3a7-6351a11e6e39",
      { category: "competition" }
    ),
    visualMode: "generated",
    expectedArtifacts: expectedArtifacts()
  },
  {
    id: "title-three-lines",
    campaignBrief: baseBrief,
    confirmedDocument: document(
      "da2d7319-191d-4510-ac0f-9046215f9a7d",
      {
        title: "九号全球员工秋季家庭日跨团队协作体验活动"
      }
    ),
    visualMode: "generated",
    expectedArtifacts: expectedArtifacts({
      portrait: fail("brand.title.max_lines")
    })
  },
  {
    id: "title-overflow",
    campaignBrief: baseBrief,
    confirmedDocument: document(
      "5241053f-acbb-4bc4-a23e-02e31678c5df",
      {
        title: "2026 九号全球员工秋季家庭日暨跨团队协作体验与创意挑战赛"
      }
    ),
    visualMode: "generated",
    expectedArtifacts: expectedArtifacts({
      portrait: fail("brand.title.max_lines"),
      landscape: fail("brand.title.max_lines"),
      banner: fail("brand.title.max_lines"),
      longform: fail("brand.title.max_lines")
    })
  },
  {
    id: "missing-optional",
    campaignBrief: {
      ...baseBrief,
      includeQr: false,
      ctaLabel: "",
      qrPayload: "",
      contact: ""
    },
    confirmedDocument: document(
      "b0248f41-a1b2-483e-aa2f-b69a91d02fe8",
      {
        subtitle: "",
        includeQr: false,
        ctaLabel: "",
        qrPayload: "",
        contact: ""
      }
    ),
    visualMode: "generated",
    expectedArtifacts: expectedArtifacts({ longformHeight: [2200, 3400] })
  },
  {
    id: "with-qr",
    campaignBrief: {
      ...baseBrief,
      includeQr: true,
      ctaLabel: "扫码报名",
      qrPayload: "https://example.com/employee-activity/register",
      contact: "行政服务台"
    },
    confirmedDocument: document(
      "8c902d4f-cef8-4e18-b907-7e12ab79d7b7",
      {
        includeQr: true,
        ctaLabel: "扫码报名",
        qrPayload: "https://example.com/employee-activity/register",
        contact: "行政服务台"
      }
    ),
    visualMode: "generated",
    expectedArtifacts: expectedArtifacts({ longformHeight: [2600, 4000] })
  },
  {
    id: "long-copy",
    campaignBrief: {
      ...baseBrief,
      description:
        "邀请每一位同事和家人一起参与跨团队协作体验、主题分享、手作市集与秋日草坪互动，在轻松的共同任务中认识新伙伴并了解不同团队的创造力。",
      sessions: [
        {
          label: "上海主会场",
          date: "2026-10-26",
          time: "09:30–18:00",
          location:
            "上海总部园区 A 栋一层多功能厅及中央草坪活动区域",
          details: ["请提前十五分钟签到", "儿童需由监护人陪同"]
        },
        {
          label: "常州分会场",
          date: "2026-10-28",
          time: "10:00–17:30",
          location: "常州制造基地共享空间与户外活动区域",
          details: ["请携带员工证", "按现场分组参与活动"]
        }
      ],
      highlights: [
        "跨团队协作",
        "亲子手作市集",
        "主题分享",
        "秋日草坪互动"
      ],
      participationSteps: [
        "在活动系统中选择参与场次、同行人数并提交报名信息",
        "收到确认通知后按场次时间到达对应签到区域",
        "在行政服务台领取活动手册并根据现场分组参与体验",
        "活动结束后在内部问卷中提交建议与照片授权选择"
      ],
      notice:
        "具体分区、活动资源和流程以现场安排为准；如遇降雨或其他不可控情况，户外环节将调整至室内区域，变更信息会通过飞书另行通知。"
    },
    confirmedDocument: document(
      "d63d41f3-3546-41ce-9080-cd4bca3d8e1c",
      {
        summary:
          "邀请同事和家人共同参与协作体验、主题分享与手作市集，在秋日相聚中认识新伙伴。",
        sessions: [
          {
            label: "上海主会场",
            date: "2026-10-26",
            time: "09:30–18:00",
            location:
              "上海总部园区 A 栋一层多功能厅及中央草坪活动区域",
            details: ["请提前十五分钟签到", "儿童需由监护人陪同"]
          },
          {
            label: "常州分会场",
            date: "2026-10-28",
            time: "10:00–17:30",
            location: "常州制造基地共享空间与户外活动区域",
            details: ["请携带员工证", "按现场分组参与活动"]
          }
        ],
        highlights: [
          "跨团队协作",
          "亲子手作市集",
          "主题分享",
          "秋日草坪互动"
        ],
        participationSteps: [
          "在活动系统中选择参与场次、同行人数并提交报名信息",
          "收到确认通知后按场次时间到达对应签到区域",
          "在行政服务台领取活动手册并根据现场分组参与体验",
          "活动结束后在内部问卷中提交建议与照片授权选择"
        ],
        notice:
          "具体分区、活动资源和流程以现场安排为准；如遇降雨或其他不可控情况，户外环节将调整至室内区域，变更信息会通过飞书另行通知。"
      }
    ),
    visualMode: "generated",
    expectedArtifacts: expectedArtifacts({
      portrait: fail("content.capacity"),
      longformHeight: [3400, 5600]
    })
  },
  {
    id: "image-fallback",
    campaignBrief: baseBrief,
    confirmedDocument: document(
      "2fe2ef15-1dc6-48ea-96ae-a98b96be4c4f",
      {}
    ),
    visualMode: "fallback",
    expectedArtifacts: expectedArtifacts({
      portrait: {
        passed: true,
        errors: [],
        warnings: ["visual.asset_fallback"]
      },
      landscape: {
        passed: true,
        errors: [],
        warnings: ["visual.asset_fallback"]
      },
      banner: {
        passed: true,
        errors: [],
        warnings: ["visual.asset_fallback"]
      },
      longform: {
        passed: true,
        errors: [],
        warnings: ["visual.asset_fallback"]
      }
    })
  }
];
