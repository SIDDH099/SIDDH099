import React, { useState, useMemo } from 'react';
import {
  Settings,
  Shield,
  Download,
  Upload,
  RefreshCw,
  Store,
  Lock,
  Smartphone,
  Camera,
  Trash2,
  Archive,
  Search,
  ReceiptText,
  Printer,
  RotateCcw,
  X,
  CheckCircle2,
  Calendar,
  Flame,
  Cloud,
  AlertTriangle
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { dbService } from '../../db/indexedDB';
import { PWAInstallButton } from '../common/PWAInstallButton';

export const SettingsView: React.FC = () => {
  const {
    settings,
    updateSettings,
    refreshAllData,
    blouseOrders,
    fallPicoOrders,
    receipts,
    isFirebaseLive,
    syncLocalToCloud,
    updateOrderStatus,
    setSelectedReceiptId,
    setSelectedBlouseSummaryId,
    setSelectedCustomerId,
    showToast
  } = useApp();

  // Shop details form
  const [shopName, setShopName] = useState(settings.shopName);
  const [ownerName, setOwnerName] = useState(settings.ownerName);
  const [phone, setPhone] = useState(settings.phone);
  const [alternatePhone, setAlternatePhone] = useState(settings.alternatePhone || '');
  const [address, setAddress] = useState(settings.address);
  const [tagline, setTagline] = useState(settings.tagline);
  const [logoUrl, setLogoUrl] = useState<string | undefined>(settings.logoUrl);
  const [defaultBlouseRate, setDefaultBlouseRate] = useState(settings.defaultBlouseRate);
  const [defaultFallPicoRate, setDefaultFallPicoRate] = useState(settings.defaultFallPicoRate);

  // PIN Change form
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);

  // Completed Orders Archive Dialog State
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);
  const [archiveSearch, setArchiveSearch] = useState('');

  // Filter all completed ('ग्राहकाला दिले') orders
  const completedBlouseOrders = useMemo(() => {
    return blouseOrders.filter(o => o.status === 'ग्राहकाला दिले');
  }, [blouseOrders]);

  const completedFallPicoOrders = useMemo(() => {
    return fallPicoOrders.filter(fp => fp.status === 'ग्राहकाला दिले');
  }, [fallPicoOrders]);

  const filteredArchivedBlouses = useMemo(() => {
    const q = archiveSearch.trim().toLowerCase();
    if (!q) return completedBlouseOrders;
    return completedBlouseOrders.filter(
      o =>
        o.orderNumber.toLowerCase().includes(q) ||
        o.customerId.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.customerMobile.includes(q) ||
        o.pattern.toLowerCase().includes(q)
    );
  }, [completedBlouseOrders, archiveSearch]);

  const handleOpenReceipt = (orderId: string) => {
    const found = receipts.find(r => r.orderId === orderId);
    if (found) {
      setSelectedReceiptId(found.id);
    } else {
      showToast('या ऑर्डरची पावती आढळली नाही.', 'info');
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      showToast('कृपया ३ MB पेक्षा लहान लोगो फोटो निवडा.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setLogoUrl(dataUrl);
      await updateSettings({ logoUrl: dataUrl });
      showToast('दुकानाचा लोगो यशस्वीरित्या अपलोड झाला!');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = async () => {
    setLogoUrl(undefined);
    await updateSettings({ logoUrl: '' });
    showToast('लोगो हटवला गेला.', 'info');
  };

  const handleSaveShopDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateSettings({
      shopName: shopName.trim(),
      ownerName: ownerName.trim(),
      phone: phone.trim(),
      alternatePhone: alternatePhone.trim(),
      address: address.trim(),
      tagline: tagline.trim(),
      logoUrl,
      defaultBlouseRate: Number(defaultBlouseRate) || 450,
      defaultFallPicoRate: Number(defaultFallPicoRate) || 70,
    });
  };

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentPin !== settings.ownerPin) {
      showToast('सध्याचा पिन चुकीचा आहे.', 'error');
      return;
    }
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      showToast('नवीन पिन बरोबर ४-अंकी असावा.', 'error');
      return;
    }
    if (newPin !== confirmPin) {
      showToast('नवीन पिन आणि कन्फर्म पिन जुळत नाहीत.', 'error');
      return;
    }

    await updateSettings({ ownerPin: newPin });
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
    showToast('मालक लॉगिन पिन यशस्वीरित्या बदलला!');
  };

  const handleExportBackup = async () => {
    setIsExporting(true);
    try {
      const jsonBackup = await dbService.exportFullBackup();
      const blob = new Blob([jsonBackup], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `manisha_blouse_center_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('डेटा बॅकअप JSON फाईल यशस्वीरित्या सेव्ह झाली!');
    } catch (err) {
      showToast('बॅकअप काढताना त्रुटी आली.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm('सावधान: बॅकअप रिस्टोअर केल्यास सध्याचा डेटा फाईलमधील माहितीने बदलला जाईल. आपण पुढे जाऊ इच्छिता?')) {
      e.target.value = '';
      return;
    }

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const res = await dbService.importFullBackup(reader.result as string);
      if (res.success) {
        await refreshAllData();
        showToast(res.message);
      } else {
        showToast(res.message, 'error');
      }
      setIsImporting(false);
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  const handleResetData = async () => {
    if (window.confirm('सावधान: हा पर्याय सर्व डेटा रीसेट करून प्राथमिक नमुना डेटा लोड करेल. आपण खात्रीपूर्वक रीसेट करू इच्छिता?')) {
      await dbService.resetToSampleData();
      await refreshAllData();
      showToast('डेटाबेस प्राथमिक नमुना माहितीवर रीसेट झाला!');
    }
  };

  const handleCloudSync = async () => {
    setIsSyncingCloud(true);
    await syncLocalToCloud();
    setIsSyncingCloud(false);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-3xl border border-rose-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-rose-100 text-rose-950">
              <Settings className="w-5 h-5" />
            </div>
            <h2 className="font-boutique text-xl font-bold text-rose-950">
              ⚙️ सेटिंग्ज, पूर्ण झालेल्या ऑर्डर्स व डेटा सुरक्षा
            </h2>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            दुकान माहिती, पूर्ण झालेल्या ऑर्डर्सचा इतिहास (Archive), पिन बदल आणि डेटा बॅकअप.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsArchiveDialogOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-rose-900 to-amber-700 hover:from-rose-950 hover:to-amber-800 text-white text-xs sm:text-sm font-bold shadow-md transition active:scale-95"
        >
          <Archive className="w-4 h-4 text-amber-300" />
          <span>📦 झालेल्या / पूर्ण झालेल्या ऑर्डर्सचा इतिहास ({completedBlouseOrders.length + completedFallPicoOrders.length})</span>
        </button>
      </div>

      {/* NEW: COMPLETED ORDERS ARCHIVE BANNER CARD */}
      <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-amber-50 via-white to-rose-50 border-2 border-amber-300 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Archive className="w-5 h-5 text-rose-900" />
            <h3 className="font-boutique font-bold text-base sm:text-lg text-rose-950">
              झालेल्या / पूर्ण झालेल्या ऑर्डर्सचा इतिहास (Completed Orders Archive)
            </h3>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 text-xs font-mono font-bold">
              एकूण पूर्ण: {completedBlouseOrders.length + completedFallPicoOrders.length}
            </span>
          </div>
          <p className="text-xs text-stone-600">
            ज्या ऑर्डर्सची स्थिती <strong>'ग्राहकाला दिले' (Delivered)</strong> झाली आहे, त्या मुख्य ब्लाऊज शिलाई यादीतून बाजूला होऊन येथे सुरक्षित राहतात.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsArchiveDialogOpen(true)}
          className="px-5 py-2.5 rounded-2xl bg-rose-900 hover:bg-rose-950 text-amber-200 text-xs sm:text-sm font-bold shadow transition shrink-0"
        >
          पूर्ण झालेल्या ऑर्डर्स उघडा →
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Shop & Business Info */}
        <div className="p-5 sm:p-6 rounded-3xl bg-white border border-stone-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-stone-100">
            <Store className="w-5 h-5 text-rose-800" />
            <h3 className="font-bold text-sm text-stone-900">
              दुकान व संपर्क तपशील (Shop Information)
            </h3>
          </div>

          <form onSubmit={handleSaveShopDetails} className="space-y-3.5 text-xs text-stone-700">
            {/* Boutique Logo Upload */}
            <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="Boutique Logo"
                    className="w-14 h-14 rounded-2xl object-contain bg-white border-2 border-amber-400 p-1 shadow-sm"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-rose-950 text-amber-300 flex flex-col items-center justify-center font-boutique font-bold border-2 border-amber-400">
                    <span className="text-xl leading-none">म</span>
                    <span className="text-[8px]">LOGO</span>
                  </div>
                )}
                <div>
                  <span className="font-bold text-stone-900 block">
                    🌺 दुकानाचा लोगो (Boutique Logo Upload)
                  </span>
                  <span className="text-[11px] text-stone-500">
                    हा लोगो डिजिटल पावती, डॅशबोर्ड आणि हेडरवर आपोआप दिसेल.
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-900 hover:bg-rose-950 text-amber-200 text-xs font-bold cursor-pointer shadow-sm transition">
                  <Camera className="w-3.5 h-3.5" />
                  <span>{logoUrl ? 'लोगो बदला' : '+ लोगो निवडा'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoUpload}
                  />
                </label>
                {logoUrl && (
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="p-2 rounded-xl bg-red-100 hover:bg-red-200 text-red-700 transition"
                    title="लोगो हटवा"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block font-bold text-stone-700 mb-1">दुकानाचे नाव (Shop Name)</label>
              <input
                type="text"
                required
                value={shopName}
                onChange={e => setShopName(e.target.value)}
                className="w-full rounded-xl border border-stone-300 py-2 px-3 text-xs sm:text-sm font-bold text-stone-900 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-stone-700 mb-1">मालकीण नाव (Owner)</label>
                <input
                  type="text"
                  value={ownerName}
                  onChange={e => setOwnerName(e.target.value)}
                  className="w-full rounded-xl border border-stone-300 py-2 px-3 text-xs sm:text-sm focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-bold text-stone-700 mb-1">मुख्य मोबाईल नंबर</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full rounded-xl border border-stone-300 py-2 px-3 text-xs sm:text-sm font-mono focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-stone-700 mb-1">दुकानाचा पत्ता</label>
              <input
                type="text"
                value={address}
                onChange={e => setAddress(e.target.value)}
                className="w-full rounded-xl border border-stone-300 py-2 px-3 text-xs sm:text-sm focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-stone-700 mb-1">टॅगलाईन (Tagline)</label>
              <input
                type="text"
                value={tagline}
                onChange={e => setTagline(e.target.value)}
                className="w-full rounded-xl border border-stone-300 py-2 px-3 text-xs sm:text-sm focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-stone-700 mb-1">डीफॉल्ट ब्लाऊज दर (₹)</label>
                <input
                  type="number"
                  value={defaultBlouseRate}
                  onChange={e => setDefaultBlouseRate(Number(e.target.value) || 0)}
                  className="w-full rounded-xl border border-stone-300 py-2 px-3 text-xs font-mono font-bold focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-bold text-stone-700 mb-1">डीफॉल्ट फॉल-पिको दर (₹)</label>
                <input
                  type="number"
                  value={defaultFallPicoRate}
                  onChange={e => setDefaultFallPicoRate(Number(e.target.value) || 0)}
                  className="w-full rounded-xl border border-stone-300 py-2 px-3 text-xs font-mono font-bold focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-rose-900 hover:bg-rose-950 text-white font-bold text-xs shadow transition active:scale-95"
            >
              दुकान माहिती जतन करा
            </button>
          </form>
        </div>

        {/* Card 2: Security & PIN Code */}
        <div className="space-y-6">
          <div className="p-5 sm:p-6 rounded-3xl bg-white border border-stone-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-stone-100">
              <Lock className="w-5 h-5 text-amber-700" />
              <h3 className="font-bold text-sm text-stone-900">
                मालक लॉगिन पिन बदला (Change Owner PIN)
              </h3>
            </div>

            <form onSubmit={handleChangePin} className="space-y-3 text-xs text-stone-700">
              <div className="p-2.5 rounded-xl bg-amber-50 text-[11px] text-amber-900 border border-amber-200 flex items-center justify-between">
                <span>सध्याचा पिन सुरक्षितपणे लपवलेला आहे (Hidden Security):</span>
                <strong className="font-mono tracking-widest text-sm">••••</strong>
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">सध्याचा पिन टाका</label>
                <input
                  type="password"
                  maxLength={4}
                  required
                  placeholder="••••"
                  value={currentPin}
                  onChange={e => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full rounded-xl border border-stone-300 py-2 px-3 text-lg font-mono text-center tracking-widest focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">नवीन ४-अंकी पिन</label>
                  <input
                    type="password"
                    maxLength={4}
                    required
                    placeholder="••••"
                    value={newPin}
                    onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full rounded-xl border border-stone-300 py-2 px-3 text-lg font-mono text-center tracking-widest focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">नवीन पिन पुन्हा टाका</label>
                  <input
                    type="password"
                    maxLength={4}
                    required
                    placeholder="••••"
                    value={confirmPin}
                    onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full rounded-xl border border-stone-300 py-2 px-3 text-lg font-mono text-center tracking-widest focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-rose-950 font-bold text-xs shadow transition active:scale-95"
              >
                नवीन पिन सेव्ह करा
              </button>
            </form>
          </div>

          {/* Card 3: PWA App Installation */}
          <div className="p-5 sm:p-6 rounded-3xl bg-white border border-stone-200 shadow-sm space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-stone-100">
              <Smartphone className="w-5 h-5 text-rose-800" />
              <h3 className="font-bold text-sm text-stone-900">
                मोबाईल अ‍ॅप (Android PWA Install)
              </h3>
            </div>
            <p className="text-xs text-stone-600">
              हे अ‍ॅप थेट आपल्या Android किंवा iPhone च्या होम स्क्रीनवर इन्स्टॉल करता येते. इंटरनेट नसतानाही ग्राहक व मापवही चालू राहते.
            </p>
            <PWAInstallButton variant="settings" />
          </div>
        </div>
      </div>

      {/* Card: Firebase Firestore Cloud Sync */}
      <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-amber-50/70 via-white to-rose-50/60 border-2 border-amber-300 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-amber-200/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-amber-500 text-rose-950 font-bold shadow-sm">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-boutique font-bold text-base text-rose-950">
                  🔥 क्लाउड डेटाबेस आणि रिअल-टाइम सिंक (Firebase Firestore Sync)
                </h3>
              </div>
              <p className="text-xs text-stone-600">
                एका मोबाईलवरून मालकाने टाकलेले नवीन साडी कॅटलॉग व डिझाईन्स इतर सर्व मोबाईल व ग्राहकांना रिअल-टाइम दिसतात.
              </p>
            </div>
          </div>

          <div className="shrink-0">
            {isFirebaseLive ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-300 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>🟢 ऑनलाइन क्लाउड सिंक सक्रिय</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 text-amber-900 text-xs font-bold border border-amber-300">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                <span>स्थानिक मोड (Offline Local Only)</span>
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-stone-700">
          <div className="p-4 rounded-2xl bg-white/90 border border-stone-200 shadow-sm space-y-2">
            <div className="flex items-center gap-2 font-bold text-stone-900">
              <Cloud className="w-4 h-4 text-rose-800" />
              <span>रिअल-टाइम क्लाउड सिंक कसे काम करते?</span>
            </div>
            <ul className="space-y-1.5 text-stone-600 list-disc list-inside">
              <li>
                <strong>onSnapshot रिअल-टाइम श्रोता:</strong> जेव्हा मालक मोबाईलवरून नवीन साडी किंवा डिझाईन सेव्ह करतो, तेव्हा पेज रिफ्रेश न करता सर्व ग्राहकांच्या फोनवर तात्काळ दिसते.
              </li>
              <li>
                <strong>हायब्रिड ऑफलाइन सपोर्ट:</strong> इंटरनेट नसतानाही स्थानिक IndexedDB मध्ये सर्व डेटा सुरक्षित राहतो, आणि इंटरनेट येताच ऑनलाइन सिंक होतो.
              </li>
            </ul>
          </div>

          <div className="p-4 rounded-2xl bg-white/90 border border-stone-200 shadow-sm space-y-2 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="font-bold text-stone-900">
                ⚡ स्थानिक कॅटलॉग डेटा क्लाउडवर पाठवा (Bulk Upload)
              </div>
              <p className="text-stone-600">
                तुमच्या सध्याच्या फोनमधील सर्व साड्या आणि डिझाईन्स एका क्लिकवर मोफत Firebase क्लाउडवर पाठवा.
              </p>
            </div>

            <button
              type="button"
              onClick={handleCloudSync}
              disabled={isSyncingCloud}
              className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-rose-900 to-amber-700 hover:from-rose-950 hover:to-amber-800 text-white font-bold text-xs shadow-md transition active:scale-95 disabled:opacity-50"
            >
              <Flame className="w-4 h-4 text-amber-300" />
              <span>{isSyncingCloud ? 'क्लाउडवर सिंक होत आहे...' : 'स्थानिक सर्व कॅटलॉग क्लाउडवर सिंक करा'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Card 4: Database Backup & Restore */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white border border-stone-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-700" />
            <h3 className="font-bold text-sm text-stone-900">
              डेटा बॅकअप आणि सुरक्षितता (Backup & Restore)
            </h3>
          </div>
          <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
            IndexedDB + LocalStorage
          </span>
        </div>

        <p className="text-xs text-stone-600">
          आपला सर्व डेटा (ग्राहक, मापवही, ब्लाऊज ऑर्डर्स, फॉल-पिको, कॅटलॉग, पावत्या) आपल्या डिव्हाइसवर सुरक्षित साठवला जातो. भविष्यातील सुरक्षिततेसाठी किंवा दुसऱ्या मोबाईलवर डेटा नेण्यासाठी JSON बॅकअप नियमितपणे डाऊनलोड करा.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          {/* Export JSON Button */}
          <button
            onClick={handleExportBackup}
            disabled={isExporting}
            className="flex items-center justify-center gap-2 p-3.5 rounded-2xl bg-stone-900 hover:bg-black text-white text-xs font-bold transition shadow-md active:scale-95 disabled:opacity-50"
          >
            <Download className="w-4 h-4 text-amber-400" />
            <span>{isExporting ? 'बॅकअप तयार होत आहे...' : 'संपूर्ण डेटा बॅकअप डाऊनलोड (JSON)'}</span>
          </button>

          {/* Import JSON Button */}
          <label className="flex items-center justify-center gap-2 p-3.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-rose-950 text-xs font-bold transition shadow-md active:scale-95 cursor-pointer">
            <Upload className="w-4 h-4 text-rose-950" />
            <span>{isImporting ? 'रिस्टोअर चालू आहे...' : 'बॅकअप रिस्टोअर करा (JSON)'}</span>
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImportBackup}
            />
          </label>

          {/* Reset sample data */}
          <button
            onClick={handleResetData}
            className="flex items-center justify-center gap-2 p-3.5 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-900 text-xs font-bold transition border border-rose-200 active:scale-95"
          >
            <RefreshCw className="w-4 h-4" />
            <span>प्राथमिक नमुना डेटा रीसेट</span>
          </button>
        </div>
      </div>

      {/* COMPLETED ORDERS ARCHIVE DIALOG MODAL */}
      {isArchiveDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto animate-fadeIn">
          <div className="w-full max-w-4xl rounded-3xl bg-white shadow-2xl border-2 border-amber-300 overflow-hidden my-4 sm:my-8 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-rose-950 via-rose-900 to-amber-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-400 text-rose-950 font-bold">
                  <Archive className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-boutique font-bold text-lg text-amber-100">
                    📦 झालेल्या / पूर्ण झालेल्या ऑर्डर्सचा इतिहास (Completed Orders Archive)
                  </h3>
                  <p className="text-xs text-amber-300/80">
                    'ग्राहकाला दिले' (Delivered) झालेल्या सर्व जुन्या ऑर्डर्सची सुरक्षित यादी
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsArchiveDialogOpen(false)}
                className="p-1.5 rounded-full text-stone-300 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search bar */}
            <div className="p-4 bg-stone-50 border-b border-stone-200">
              <div className="relative">
                <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={archiveSearch}
                  onChange={e => setArchiveSearch(e.target.value)}
                  placeholder="पूर्ण झालेली ऑर्डर क्र. (BO-101), ग्राहक नाव, मोबाईल किंवा आयडी शोधा..."
                  className="w-full rounded-2xl bg-white border border-stone-300 pl-10 pr-4 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </div>

            {/* Archived Orders List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 bg-[#FFFDF9]">
              {filteredArchivedBlouses.length === 0 && completedFallPicoOrders.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl border border-stone-200">
                  <CheckCircle2 className="w-10 h-10 text-stone-300 mx-auto mb-2" />
                  <p className="text-xs sm:text-sm font-bold text-stone-600">
                    अद्याप कोणतीही पूर्ण झालेली ('ग्राहकाला दिले') ऑर्डर संग्रहित नाही.
                  </p>
                  <p className="text-xs text-stone-400 mt-1">
                    जेव्हा तुम्ही ब्लाऊज ऑर्डरची स्थिती 'ग्राहकाला दिले' कराल, तेव्हा ती आपोआप येथे जमा होईल.
                  </p>
                </div>
              ) : (
                <>
                  {filteredArchivedBlouses.map(order => (
                    <div
                      key={order.id}
                      className="p-4 rounded-2xl bg-white border border-stone-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-bold text-xs bg-rose-100 text-rose-900 px-2.5 py-0.5 rounded-lg">
                            {order.orderNumber}
                          </span>
                          <span
                            onClick={() => {
                              setIsArchiveDialogOpen(false);
                              setSelectedCustomerId(order.customerId);
                            }}
                            className="font-bold text-sm text-stone-900 hover:text-rose-900 cursor-pointer underline"
                          >
                            {order.customerName}
                          </span>
                          <span className="text-xs text-stone-500 font-mono">
                            (ID: {order.customerId} • {order.customerMobile})
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                            ✓ ग्राहकाला दिले
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-stone-600">
                          <span>पॅटर्न: <strong>{order.pattern}</strong></span>
                          {order.blouseColor && (
                            <span className="inline-flex items-center gap-1">
                              <span
                                className="w-2.5 h-2.5 rounded-full border border-black/20"
                                style={{ backgroundColor: order.blouseColorHex || '#BE185D' }}
                              />
                              <span>{order.blouseColor}</span>
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-stone-400" />
                            डिलिव्हरी: <strong>{order.deliveryDate}</strong>
                          </span>
                          <span>एकूण: <strong>₹{order.totalAmount}</strong></span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setSelectedBlouseSummaryId(order.id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-900 text-xs font-bold border border-rose-200 transition"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>मापे PDF</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenReceipt(order.id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-950 text-xs font-bold border border-amber-200 transition"
                        >
                          <ReceiptText className="w-3.5 h-3.5" />
                          <span>पावती पहा</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => updateOrderStatus(order.id, 'डिलिव्हरीसाठी तयार')}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold transition"
                          title="पुन्हा चालू यादीत परत पाठवा"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>पुन्हा चालू करा</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>

            <div className="p-4 border-t border-stone-200 bg-stone-50 flex items-center justify-between">
              <span className="text-xs text-stone-500">
                एकूण संग्रहित ऑर्डर्स: <strong>{completedBlouseOrders.length}</strong>
              </span>
              <button
                type="button"
                onClick={() => setIsArchiveDialogOpen(false)}
                className="px-5 py-2 rounded-xl bg-stone-800 hover:bg-stone-900 text-white text-xs font-bold"
              >
                बंद करा
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
