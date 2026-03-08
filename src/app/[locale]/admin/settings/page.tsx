'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Loader2, Save, Globe, Shield, Bell, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function AdminSettingsPage() {
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = () => {
        setIsSaving(true);
        setTimeout(() => {
            setIsSaving(false);
            toast({
                title: "Settings saved",
                description: "System configuration has been updated successfully.",
            });
        }, 1000);
    };

    return (
        <div className="space-y-8 max-w-4xl">
            <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">System Settings</h2>
                <p className="text-slate-500">Configure global platform parameters and integration settings</p>
            </div>

            <div className="grid gap-6">
                <Card className="border-none shadow-sm rounded-3xl p-6">
                    <CardHeader className="px-0 pt-0">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
                                <Globe className="w-5 h-5" />
                            </div>
                            <div>
                                <CardTitle className="text-lg font-bold">General Configuration</CardTitle>
                                <CardDescription>Basic platform information and localization</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="px-0 pt-4 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="site-name">Platform Name</Label>
                                <Input id="site-name" defaultValue="Cap and Deal" className="rounded-xl border-slate-200" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="support-email">Support Email</Label>
                                <Input id="support-email" defaultValue="support@lawslane.com" className="rounded-xl border-slate-200" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm rounded-3xl p-6">
                    <CardHeader className="px-0 pt-0">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
                                <Zap className="w-5 h-5" />
                            </div>
                            <div>
                                <CardTitle className="text-lg font-bold">Feature Toggles</CardTitle>
                                <CardDescription>Enable or disable specific system functionalities</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="px-0 pt-4 space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-base font-bold">AI Contract Drafting</Label>
                                <p className="text-sm text-slate-500 text-slate-500 font-medium">Allow users to generate contracts using Gemini AI</p>
                            </div>
                            <Switch defaultChecked />
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-base font-bold">PromptPay Integration</Label>
                                <p className="text-sm text-slate-500 text-slate-500 font-medium">Process automatic payments via QR Code</p>
                            </div>
                            <Switch defaultChecked />
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-base font-bold">Public Registration</Label>
                                <p className="text-sm text-slate-500 text-slate-500 font-medium">Allow new users to create accounts</p>
                            </div>
                            <Switch defaultChecked />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm rounded-3xl p-6">
                    <CardHeader className="px-0 pt-0">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-amber-50 rounded-xl text-amber-600">
                                <Shield className="w-5 h-5" />
                            </div>
                            <div>
                                <CardTitle className="text-lg font-bold">Security & Maintenance</CardTitle>
                                <CardDescription>Access control and system status</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="px-0 pt-4 space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-base font-bold">Maintenance Mode</Label>
                                <p className="text-sm text-slate-500 text-slate-500 font-medium">Restrict user access while performing updates</p>
                            </div>
                            <Switch />
                        </div>
                    </CardContent>
                </Card>

                <div className="flex justify-end gap-3">
                    <Button variant="outline" className="rounded-xl border-slate-200 h-11 px-6">Cancel</Button>
                    <Button
                        className="rounded-xl bg-slate-900 text-white h-11 px-8 gap-2"
                        onClick={handleSave}
                        disabled={isSaving}
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save Changes
                    </Button>
                </div>
            </div>
        </div>
    );
}
