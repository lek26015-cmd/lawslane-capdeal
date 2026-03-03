'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import {
    Facebook,
    Link as LinkIcon,
    MessageCircle, // Using as Line icon placeholder
    Twitter,
    Check
} from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

interface ShareButtonsProps {
    url?: string;
    title?: string;
    description?: string;
    className?: string;
}

export function ShareButtons({ url, title, description, className = '' }: ShareButtonsProps) {
    const { toast } = useToast();
    const [copied, setCopied] = useState(false);

    // Default to current location if URL not provided
    const shareUrl = typeof window !== 'undefined' ? (url || window.location.href) : '';
    const shareTitle = title || '';

    const handleCopyLink = () => {
        navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        toast({
            title: "คัดลอกลิงก์แล้ว",
            description: "คุณสามารถส่งลิงก์นี้ให้ผู้อื่นได้ทันที",
        });
        setTimeout(() => setCopied(false), 2000);
    };

    const shareToFacebook = () => {
        const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
        window.open(fbUrl, '_blank', 'width=600,height=400');
    };

    const shareToLine = () => {
        const lineUrl = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(shareUrl)}`;
        window.open(lineUrl, '_blank', 'width=600,height=400');
    };

    const shareToTwitter = () => {
        const twitterUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareTitle)}`;
        window.open(twitterUrl, '_blank', 'width=600,height=400');
    };

    return (
        <div className={`flex flex-wrap items-center gap-2 ${className}`}>
            <span className="text-sm font-medium text-muted-foreground mr-1">แชร์:</span>

            <Button
                variant="outline"
                size="icon"
                onClick={shareToFacebook}
                className="rounded-full w-9 h-9 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors"
                title="แชร์ไปยัง Facebook"
            >
                <Facebook className="w-4 h-4" />
            </Button>

            <Button
                variant="outline"
                size="icon"
                onClick={shareToLine}
                className="rounded-full w-9 h-9 hover:bg-green-50 hover:text-green-600 hover:border-green-200 transition-colors"
                title="แชร์ไปยัง Line"
            >
                {/* Use MessageCircle as a proxy for Line if a dedicated icon isn't available */}
                <MessageCircle className="w-4 h-4" />
            </Button>

            <Button
                variant="outline"
                size="icon"
                onClick={shareToTwitter}
                className="rounded-full w-9 h-9 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-200 transition-colors"
                title="แชร์ไปยัง X"
            >
                <Twitter className="w-4 h-4" />
            </Button>

            <Button
                variant="outline"
                size="icon"
                onClick={handleCopyLink}
                className="rounded-full w-9 h-9 hover:bg-muted transition-colors"
                title="คัดลอกลิงก์"
            >
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <LinkIcon className="w-4 h-4" />}
            </Button>
        </div>
    );
}
