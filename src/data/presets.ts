import { PresetSample } from '../types';

export const PRESET_SAMPLES: PresetSample[] = [
  // 1. Appliances & Items (Camera Mode)
  {
    id: 'microwave-panel',
    mode: 'camera',
    category: 'Appliance',
    title: {
      en: 'Panasonic Microwave Panel',
      zh: '松下微波炉操作面板'
    },
    description: {
      en: 'Help me understand how to heat soup for 2 minutes and defrost bread.',
      zh: '教我如何热汤2分钟以及如何解冻面包。'
    },
    defaultQuestion: {
      en: 'How do I use this microwave to heat my food for 2 minutes?',
      zh: '这个微波炉怎么用？我想热2分钟食物。'
    },
    imageUrl: 'https://images.unsplash.com/photo-1574269909862-7e1d70bb8078?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'heat-pump-remote',
    mode: 'camera',
    category: 'Appliance',
    title: {
      en: 'Heat Pump Remote Controller',
      zh: '冷暖热泵空调遥控器'
    },
    description: {
      en: 'Which button turns on heating (sun icon) and sets it to 22 degrees?',
      zh: '哪个按键是开暖气（太阳图标）并调到22度？'
    },
    defaultQuestion: {
      en: 'Which button is for heating and how do I make the room warmer?',
      zh: '哪个按键是开制热暖风？怎么调暖和一点？'
    },
    imageUrl: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'medicine-bottle',
    mode: 'camera',
    category: 'Household',
    title: {
      en: 'Prescription Medicine Bottle',
      zh: '处方药瓶标签'
    },
    description: {
      en: 'Read the text on the label: help me clearly see what is printed.',
      zh: '看懂药瓶标签：帮我看清楚药瓶上印的文字内容。'
    },
    defaultQuestion: {
      en: 'Can you read the text printed on this medicine label for me?',
      zh: '能帮我看清楚这个药瓶标签上写了什么文字吗？'
    },
    imageUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=800&q=80'
  },

  // 2. Documents & Letters (Document Mode)
  {
    id: 'winz-letter',
    mode: 'document',
    category: 'NZ Official',
    title: {
      en: 'WINZ Notice: Winter Energy Payment',
      zh: '新西兰WINZ工收局：冬季采暖补贴通知'
    },
    description: {
      en: 'Official notification from Work and Income NZ regarding annual Winter Energy Payment.',
      zh: '新西兰工作与收入局（WINZ）关于冬季能源补助金发放的官方通知信。'
    },
    defaultQuestion: {
      en: 'What does this WINZ letter say, and do I need to reply or do anything?',
      zh: '这封WINZ工收局的信在说什么？我需要做什么或者回信吗？'
    },
    text: `Work and Income (Te Hiranga Tangata) - Ministry of Social Development
Client Number: 948-231-002
Date: 15 May 2026
Dear Resident,

RE: Your Winter Energy Payment 2026

We are writing to let you know that you are eligible for the Winter Energy Payment starting from 1 May to 1 October. 

Payment Details:
- Rate: $31.83 per week (single rate)
- Starting Date: Paid automatically into your regular bank account alongside your Superannuation payment.
- Action Required: NONE. You do NOT need to contact us or apply. The payments will be added to your regular superannuation payments automatically.

If you are travelling overseas for more than 28 days, please call us on 0800 559 009.

Warm regards,
Work and Income New Zealand`
  },
  {
    id: 'hospital-appointment',
    mode: 'document',
    category: 'Healthcare',
    title: {
      en: 'Te Whatu Ora Hospital Appointment Letter',
      zh: '新西兰公立医院专科门诊预约信'
    },
    description: {
      en: 'Auckland City Hospital Cardiology Clinic appointment confirmation with instructions.',
      zh: '奥克兰市医院心脏专科门诊复查预约确认及准备注意事项。'
    },
    defaultQuestion: {
      en: 'When and where is my appointment, and what must I bring with me?',
      zh: '我什么时候去哪里看病？需要提前准备带什么东西？'
    },
    text: `Te Whatu Ora - Health New Zealand
Auckland City Hospital, Outpatient Clinic Building 32
Date: 22 August 2026

Dear Patient,
Appointment Confirmation: Cardiology Review Clinic

Appointment Date: Thursday, 17 September 2026
Time: 10:15 AM (Please arrive 15 minutes early at 10:00 AM)
Location: Level 2, Greenlane Clinical Centre, 214 Green Lane West, Epsom, Auckland.
Doctor: Dr. Andrew Campbell (Consultant Cardiologist)

Instructions:
1. Please bring all current medications and prescriptions in their original boxes.
2. Please wear comfortable shoes as you may undergo a gentle 5-minute walking check.
3. You may bring a support person or family member.

If you need to change this date, please telephone (09) 307 4949 at least 3 days in advance.`
  },
  {
    id: 'power-bill',
    mode: 'document',
    category: 'Utility Bill',
    title: {
      en: 'Genesis Energy Monthly Electricity Bill',
      zh: 'Genesis Energy 月度电费账单'
    },
    description: {
      en: 'Monthly residential electricity bill with due date and payment details.',
      zh: '每月住宅电费账单，包含应付金额、截止日期和扣款说明。'
    },
    defaultQuestion: {
      en: 'How much is this bill, when is it due, and will it be paid automatically?',
      zh: '这期电费多少钱？什么时候截止？是自动扣款吗？'
    },
    text: `Genesis Energy New Zealand
Account Number: 8829-1049-22
Invoice Date: 10 August 2026
Service Address: 42 Titirangi Road, Auckland

BILL SUMMARY:
Total Amount Due: $148.50 NZD
Payment Due Date: 28 August 2026

Payment Method: Direct Debit set up (Your account ending in ...4491 will be debited automatically on 28 August 2026).
Action Required: No manual action needed. Ensure sufficient funds are available in your nominated bank account on the due date.`
  },

  // 3. Scam & Suspicious Message Checker (Scam Mode)
  {
    id: 'nzta-toll-scam',
    mode: 'scam',
    category: 'NZ Scam SMS',
    title: {
      en: 'NZTA Waka Kotahi Toll Scam SMS',
      zh: '冒充新西兰交通局(NZTA)路费催缴诈骗短信'
    },
    description: {
      en: 'Suspicious SMS claiming unpaid motorway toll fee with urgent link.',
      zh: '收到声称"高速路费逾期未付将罚款"的可疑短信，要求点击网址链接。'
    },
    defaultQuestion: {
      en: 'Is this text message safe or is it a scam?',
      zh: '我收到这条短信，是真的还是诈骗？我需要点进去付钱吗？'
    },
    text: `[NZTA Waka Kotahi Alert]: You have an outstanding toll fee of $4.80 NZD from your recent trip on Northern Gateway Toll Road. A late penalty fine of $75 will apply within 24 hours. Please pay immediately via: http://nzta-road-pay-update.top/nz`
  },
  {
    id: 'nz-post-scam',
    mode: 'scam',
    category: 'NZ Scam SMS',
    title: {
      en: 'NZ Post Parcel Delivery Fee Scam',
      zh: '冒充新西兰邮政(NZ Post)包裹派送费短信'
    },
    description: {
      en: 'SMS claiming parcel cannot be delivered without updating address and paying $2.10 fee.',
      zh: '声称包裹地址缺失无法送达，需要点击链接支付2.10纽币补单。'
    },
    defaultQuestion: {
      en: 'Did NZ Post send this to me? Should I click the link to update my address?',
      zh: '这是新西兰邮政发给我的吗？需要点开链接修改地址吗？'
    },
    text: `NZ Post: Your parcel #NZ889210 could not be delivered due to incomplete street address. Please update your delivery details and pay the $2.10 redelivery fee here: https://nzpost-track-service.xyz/delivery before it is returned to sender.`
  },
  {
    id: 'ird-tax-refund-scam',
    mode: 'scam',
    category: 'Email Scam',
    title: {
      en: 'Inland Revenue (IRD) Fake Tax Refund Email',
      zh: '冒充新西兰税务局(IRD)退税通知邮件'
    },
    description: {
      en: 'Email claiming you have an unclaimed tax refund of $840.50 and asking for credit card details.',
      zh: '邮件称有一笔840.50纽币未领退税，要求提供银行卡号和密码领取。'
    },
    defaultQuestion: {
      en: 'Is this tax refund real? Can I submit my bank card to get the money?',
      zh: '这个退税是真的吗？我可以输入银行卡领钱吗？'
    },
    text: `From: Inland Revenue Service <refund-notice@ird-nz-portal-secure.com>
Subject: Notice of Unclaimed Tax Refund ($840.50 NZD)
Dear Taxpayer,
Our annual calculation shows you are eligible for an immediate tax refund of $840.50 NZD.
To deposit this money directly into your account, please click the secure link below and confirm your credit card details and PIN within 48 hours:
https://ird-nz-portal-secure.com/claim-refund`
  }
];
