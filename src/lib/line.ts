import { createHmac } from 'crypto';

// ============================================================
// LINE Messaging API Utilities
// ============================================================

const LINE_API_BASE = 'https://api.line.me/v2/bot';

/**
 * Verify LINE webhook signature (HMAC-SHA256)
 */
export function verifyLineSignature(body: string, signature: string): boolean {
    const secret = process.env.LINE_CHANNEL_SECRET;
    if (!secret) {
        console.error('[LINE] LINE_CHANNEL_SECRET not set');
        return false;
    }
    const hash = createHmac('SHA256', secret).update(body).digest('base64');
    return hash === signature;
}

/**
 * Reply to a LINE message using the Reply API
 */
export async function replyMessage(replyToken: string, messages: LineMessage[]): Promise<void> {
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!token) {
        console.error('[LINE] LINE_CHANNEL_ACCESS_TOKEN not set');
        return;
    }

    const res = await fetch(`${LINE_API_BASE}/message/reply`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ replyToken, messages }),
    });

    if (!res.ok) {
        const errorBody = await res.text();
        console.error('[LINE] Reply failed:', res.status, errorBody);
    }
}

/**
 * Download image content from LINE Content API
 * Returns base64 encoded image data
 */
export async function getImageContent(messageId: string): Promise<string> {
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!token) throw new Error('LINE_CHANNEL_ACCESS_TOKEN not set');

    const res = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    if (!res.ok) {
        throw new Error(`Failed to get image content: ${res.status}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    return `data:${contentType};base64,${base64}`;
}

/**
 * Get LINE user profile
 */
export async function getLineProfile(userId: string): Promise<LineProfile> {
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!token) throw new Error('LINE_CHANNEL_ACCESS_TOKEN not set');

    const res = await fetch(`${LINE_API_BASE}/profile/${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!res.ok) {
        throw new Error(`Failed to get LINE profile: ${res.status}`);
    }

    return res.json();
}

// ============================================================
// Format helpers: ChatResponse → LINE Messages
// ============================================================

import type { ChatResponse } from '@/ai/flows/chat-flow';

/**
 * Convert ChatResponse sections into a LINE Flex Message
 */
export function formatChatResponseToFlex(response: ChatResponse, liffUrl?: string): LineFlexMessage {
    const bubbles: FlexBubble[] = response.sections.map((section) => {
        const bodyContents: FlexComponent[] = [
            {
                type: 'text',
                text: section.title,
                weight: 'bold',
                size: 'lg',
                color: '#1a1a2e',
                wrap: true,
            },
            {
                type: 'text',
                text: section.content.length > 300 ? section.content.substring(0, 300) + '...' : section.content,
                size: 'sm',
                color: '#555555',
                wrap: true,
                margin: 'md',
            },
        ];

        const footerContents: FlexComponent[] = [];

        if (section.link) {
            const url = section.link.startsWith('/') && liffUrl
                ? `${liffUrl}${section.link}`
                : section.link.startsWith('/')
                    ? `https://capdeal.lawslane.com${section.link}`
                    : section.link;

            footerContents.push({
                type: 'button',
                action: {
                    type: 'uri',
                    label: section.linkText || 'ดูเพิ่มเติม',
                    uri: url,
                },
                style: 'primary',
                color: '#06C755',
            });
        }

        const bubble: FlexBubble = {
            type: 'bubble',
            body: {
                type: 'box',
                layout: 'vertical',
                contents: bodyContents,
                paddingAll: '20px',
            },
        };

        if (footerContents.length > 0) {
            bubble.footer = {
                type: 'box',
                layout: 'vertical',
                contents: footerContents,
                spacing: 'sm',
            };
        }

        return bubble;
    });

    // If only one section, send a single bubble
    if (bubbles.length === 1) {
        return {
            type: 'flex',
            altText: response.sections[0]?.title || 'Lawslane AI',
            contents: bubbles[0],
        };
    }

    return {
        type: 'flex',
        altText: response.sections[0]?.title || 'Lawslane AI',
        contents: {
            type: 'carousel',
            contents: bubbles.slice(0, 10), // LINE allows max 10 bubbles
        },
    };
}

/**
 * Convert contract draft result into a LINE Flex Message
 */
export function formatContractToFlex(contract: ContractResult, liffUrl?: string): LineFlexMessage {
    const openLiffUrl = liffUrl
        ? `${liffUrl}/th/services/contracts/screenshot`
        : 'https://capdeal.lawslane.com/th/services/contracts/screenshot';

    return {
        type: 'flex',
        altText: `สัญญาจ้างทำ: ${contract.task}`,
        contents: {
            type: 'bubble',
            header: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    {
                        type: 'text',
                        text: '📋 ผลการวิเคราะห์สัญญา',
                        weight: 'bold',
                        size: 'lg',
                        color: '#ffffff',
                    },
                ],
                backgroundColor: '#06C755',
                paddingAll: '15px',
            },
            body: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    { type: 'text', text: `ผู้ว่าจ้าง: ${contract.employer || '-'}`, size: 'sm', wrap: true },
                    { type: 'text', text: `ผู้รับจ้าง: ${contract.contractor || '-'}`, size: 'sm', wrap: true, margin: 'sm' },
                    { type: 'text', text: `งาน: ${contract.task || '-'}`, size: 'sm', wrap: true, margin: 'sm' },
                    { type: 'text', text: `ราคา: ${contract.price ? contract.price.toLocaleString() : '-'} บาท`, size: 'sm', margin: 'sm' },
                    { type: 'text', text: `มัดจำ: ${contract.deposit ? contract.deposit.toLocaleString() : '-'} บาท`, size: 'sm', margin: 'sm' },
                    { type: 'text', text: `กำหนดส่ง: ${contract.deadline || '-'}`, size: 'sm', margin: 'sm' },
                    ...(contract.riskyTerms && contract.riskyTerms.length > 0 ? [
                        { type: 'separator' as const, margin: 'lg' as const },
                        { type: 'text' as const, text: '⚠️ ข้อควรระวัง:', weight: 'bold' as const, size: 'sm' as const, margin: 'md' as const, color: '#ff6b35' as const, wrap: true as const },
                        { type: 'text' as const, text: contract.riskyTerms.join('\n'), size: 'xs' as const, color: '#888888' as const, wrap: true as const, margin: 'sm' as const },
                    ] : []),
                ],
                paddingAll: '15px',
            },
            footer: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    {
                        type: 'button',
                        action: {
                            type: 'uri',
                            label: 'เปิดดู & สร้าง PDF',
                            uri: openLiffUrl,
                        },
                        style: 'primary',
                        color: '#06C755',
                    },
                ],
            },
        },
    };
}

/**
 * Create a welcome message when user follows the LINE OA
 */
export function createWelcomeMessage(liffUrl?: string): LineFlexMessage {
    const appUrl = liffUrl || 'https://capdeal.lawslane.com';

    return {
        type: 'flex',
        altText: 'ยินดีต้อนรับสู่ Lawslane Cap & Deal!',
        contents: {
            type: 'bubble',
            header: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    {
                        type: 'text',
                        text: '⚖️ Lawslane Cap & Deal',
                        weight: 'bold',
                        size: 'xl',
                        color: '#ffffff',
                    },
                ],
                backgroundColor: '#1a1a2e',
                paddingAll: '20px',
            },
            body: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    {
                        type: 'text',
                        text: 'สวัสดีครับ! 👋\nผมคือ AI ผู้ช่วยกฎหมายของ Lawslane',
                        wrap: true,
                        size: 'sm',
                    },
                    {
                        type: 'text',
                        text: 'คุณสามารถ:',
                        weight: 'bold',
                        size: 'sm',
                        margin: 'lg',
                    },
                    {
                        type: 'text',
                        text: '📸 ส่งรูปแชท → วิเคราะห์ & สร้างสัญญา\n💬 พิมพ์คำถาม → ปรึกษา AI กฎหมาย\n📋 กดปุ่มด้านล่าง → เปิดแอปเต็มรูปแบบ',
                        wrap: true,
                        size: 'sm',
                        margin: 'sm',
                        color: '#555555',
                    },
                ],
                paddingAll: '20px',
            },
            footer: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    {
                        type: 'button',
                        action: {
                            type: 'uri',
                            label: '🚀 เปิด Cap & Deal',
                            uri: appUrl,
                        },
                        style: 'primary',
                        color: '#06C755',
                    },
                ],
            },
        },
    };
}

// ============================================================
// Types
// ============================================================

export interface LineProfile {
    userId: string;
    displayName: string;
    pictureUrl?: string;
    statusMessage?: string;
}

export interface ContractResult {
    employer: string;
    employerId?: string;
    employerAddress?: string;
    contractor: string;
    contractorId?: string;
    contractorAddress?: string;
    task: string;
    price: number;
    deposit: number;
    deadline: string;
    paymentTerms?: string;
    missingInfo?: string[];
    riskyTerms?: string[];
}

// LINE Messaging API types
export type LineMessage = LineTextMessage | LineFlexMessage;

export interface LineTextMessage {
    type: 'text';
    text: string;
}

export interface LineFlexMessage {
    type: 'flex';
    altText: string;
    contents: FlexBubble | FlexCarousel;
}

export interface FlexBubble {
    type: 'bubble';
    header?: FlexBox;
    body?: FlexBox;
    footer?: FlexBox;
}

export interface FlexCarousel {
    type: 'carousel';
    contents: FlexBubble[];
}

export interface FlexBox {
    type: 'box';
    layout: 'horizontal' | 'vertical' | 'baseline';
    contents: FlexComponent[];
    spacing?: string;
    paddingAll?: string;
    backgroundColor?: string;
    margin?: string;
}

export type FlexComponent = FlexText | FlexButton | FlexSeparator | FlexBox;

export interface FlexText {
    type: 'text';
    text: string;
    weight?: 'regular' | 'bold';
    size?: 'xxs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
    color?: string;
    wrap?: boolean;
    margin?: string;
}

export interface FlexButton {
    type: 'button';
    action: {
        type: 'uri' | 'message' | 'postback';
        label: string;
        uri?: string;
        text?: string;
        data?: string;
    };
    style?: 'primary' | 'secondary' | 'link';
    color?: string;
    margin?: string;
}

export interface FlexSeparator {
    type: 'separator';
    margin?: string;
}

// LINE Webhook Event types
export interface LineWebhookEvent {
    type: 'message' | 'follow' | 'unfollow' | 'join' | 'leave' | 'postback';
    replyToken?: string;
    source: {
        type: 'user' | 'group' | 'room';
        userId?: string;
        groupId?: string;
        roomId?: string;
    };
    message?: {
        type: 'text' | 'image' | 'video' | 'audio' | 'file' | 'location' | 'sticker';
        id: string;
        text?: string;
    };
    timestamp: number;
}

export interface LineWebhookBody {
    events: LineWebhookEvent[];
    destination: string;
}
