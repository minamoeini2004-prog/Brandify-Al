exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  };
  const reply = (statusCode, payload) => ({ statusCode, headers, body: JSON.stringify(payload) });

  if (event.httpMethod !== 'POST') return reply(405, { error: 'روش درخواست پشتیبانی نمی‌شود.' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return reply(503, { error: 'اتصال هوش مصنوعی هنوز فعال نشده است. مدیر سایت باید GEMINI_API_KEY را در متغیرهای محیطی Netlify ثبت کند.' });

  try {
    const data = JSON.parse(event.body || '{}');
    const fields = ['name', 'field', 'education', 'goal', 'skills', 'experience', 'values', 'audience', 'platform', 'tone', 'time'];
    const clean = {};
    for (const key of fields) clean[key] = String(data[key] ?? '').trim().slice(0, key === 'experience' || key === 'skills' || key === 'values' ? 2500 : 500);

    if (!clean.field || !clean.skills || !clean.goal || !clean.audience) {
      return reply(400, { error: 'لطفاً حوزه فعالیت، مهارت‌ها، هدف و مخاطب هدف را تکمیل کنید.' });
    }

    const prompt = `تو مشاور حرفه‌ای و واقع‌گرا در زمینه برندسازی شخصی هستی. بر اساس داده‌های زیر یک دستورالعمل اختصاصی، عملی و مرحله‌به‌مرحله برای ساخت برند شخصی بنویس. هیچ مدرک، سابقه، موفقیت یا مهارتی را که در داده‌ها نیست جعل نکن. اگر اطلاعاتی ناقص است، فرض قطعی نساز و پیشنهاد را مشروط بیان کن. زبان فارسی روان و قابل فهم باشد. از توصیه‌های کلی و تکراری پرهیز کن و هر پیشنهاد را به داده‌های همین فرد مرتبط کن.

اطلاعات فرد:
نام: ${clean.name || 'ذکر نشده'}
حوزه فعالیت: ${clean.field}
تحصیلات: ${clean.education || 'ذکر نشده'}
مهارت‌ها: ${clean.skills}
سوابق/نمونه‌کارها: ${clean.experience || 'ذکر نشده'}
علایق و ارزش‌ها: ${clean.values || 'ذکر نشده'}
هدف: ${clean.goal}
مخاطب هدف: ${clean.audience}
پلتفرم: ${clean.platform || 'پیشنهاد بده'}
لحن: ${clean.tone || 'حرفه‌ای و صمیمی'}
زمان هفتگی: ${clean.time || 'ذکر نشده'}

خروجی را با تیترهای روشن و دقیقاً در این ساختار بنویس:
۱) خلاصه شناخت فرد و مواردی که هنوز باید تکمیل شوند
۲) هویت و جایگاه پیشنهادی برند (یک جمله جایگاه‌سازی)
۳) ارزش پیشنهادی و تمایزهای واقعی (بدون اغراق)
۴) مخاطب هدف و نیازهای او
۵) پیام اصلی برند، لحن و سه کلیدواژه شخصیتی
۶) پیشنهاد هویت بصری و سبک تصویر (توصیفی و قابل اجرا)
۷) معرفی حرفه‌ای/بیو در سه نسخه کوتاه
۸) ستون‌های محتوایی و ۱۰ ایده محتوای متناسب با فرد
۹) برنامه اجرایی ۳۰ روزه به تفکیک هفته و اقدام‌های مشخص
۱۰) نمونه تقویم محتوایی هفتگی شامل موضوع، قالب و دعوت به اقدام
۱۱) روش شبکه‌سازی و ارتباط حرفه‌ای
۱۲) شاخص‌های سنجش پیشرفت و روش بازبینی
۱۳) سه اقدام اول که فرد از همین امروز انجام دهد
۱۴) پرسش‌های تکمیلی برای دقیق‌تر شدن برنامه.
برنامه باید با هدف، منابع و سطح تجربه فرد متناسب باشد. اگر سابقه کاری ذکر نشده، مسیر مناسب دانشجو/فرد تازه‌کار را پیشنهاد بده. خروجی را کاربردی، مشخص و قابل اجرا بنویس.`;

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.65, maxOutputTokens: 6000 }
      })
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const status = response.status === 429 ? 429 : 502;
      const message = response.status === 429
        ? 'سهمیه یا محدودیت درخواست هوش مصنوعی پر شده است. کمی بعد دوباره تلاش کنید.'
        : (result?.error?.message || 'سرویس هوش مصنوعی پاسخ نداد. کلید API و دسترسی مدل را بررسی کنید.');
      return reply(status, { error: message });
    }

    const plan = result?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('\n').trim();
    if (!plan) return reply(502, { error: 'پاسخ معتبری از هوش مصنوعی دریافت نشد. دوباره تلاش کنید.' });
    return reply(200, { plan });
  } catch (error) {
    return reply(500, { error: 'خطا در پردازش درخواست. لطفاً دوباره تلاش کنید.' });
  }
};
