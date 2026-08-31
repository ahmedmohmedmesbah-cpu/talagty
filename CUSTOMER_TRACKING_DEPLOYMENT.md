# نشر متابعة العميل الآمنة

نفّذ الخطوات بالترتيب حتى لا تتوقف صفحة متابعة الفاتورة بين تحديث وآخر.

## 1. آلية واتساب اليدوية المجانية

لا تحتاج هذه النسخة إلى Twilio أو مزود SMS أو أي مفتاح مدفوع. بعد تأكيد الطلب يضغط المدير «إرسال كود التفعيل عبر واتساب». ينشئ الخادم كوداً آمناً صالحاً لمدة 10 دقائق ويفتح واتساب برسالة عربية جاهزة. يضغط المدير **إرسال** داخل واتساب، ثم يدخل العميل الكود في صفحة المتابعة.

## 2. تشغيل ترحيل قاعدة البيانات

افتح Supabase SQL Editor، الصق محتوى الملف:

`supabase/migrations/010_customer_device_tracking.sql`

ثم اضغط **Run** مرة واحدة. الترحيل قابل لإعادة التشغيل بأمان في الأجزاء الإنشائية، لكن لا حاجة لتشغيله أكثر من مرة.

## 3. نشر Edge Function

انشر محتوى:

`supabase/functions/talagty-api/index.ts`

داخل الدالة `talagty-api` بعد نجاح الترحيل.

## 4. نشر صفحات GitHub Pages

ادفع الملفات التالية إلى الفرع `main`:

- `track.html`
- `track.css`
- `track.js`
- `track-sw.js`
- تحديثات الواجهة المتجاوبة في صفحات المتجر و`style.css` و`script.js`

## 5. اختبار التحقق والربط

1. أنشئ طلباً جديداً من المتجر برقم هاتف عليه واتساب.
2. من الإدارة راجع الطلب واتصل بالعميل ثم اضغط «تأكيد الطلب».
3. افتح الطلب مرة أخرى واضغط «إرسال كود التفعيل عبر واتساب».
4. راجع الرسالة الجاهزة داخل واتساب واضغط إرسال.
5. افتح «متابعة فاتورتك» من هاتف العميل الأول، أدخل الرقم ثم كود واتساب.
6. أعد تحميل الصفحة وتأكد أنها تعرض الطلبات دون طلب كود جديد.
7. افتح الصفحة من هاتف ثانٍ بنفس الرقم وتأكد من ظهور رسالة أن الرقم مرتبط بجهاز آخر.

## 6. اختبار الإلغاء

1. اختبر إلغاء طلب حالته `pending_assignment` وتأكد أن حالته أصبحت `cancelled` في الإدارة.
2. اعتمد طلباً ثم ألغِه قبل `out_for_delivery` وتأكد أن `reserved_quantity` للمنتجات عاد إلى قيمته السابقة.
3. غيّر طلباً إلى `out_for_delivery` وتأكد أن زر الإلغاء لم يعد ظاهراً وأن الخادم يرفض محاولة الإلغاء المباشرة.

## 7. اختبار QR دون اتصال

1. اعتمد الطلب وأسنده إلى مندوب.
2. حدّث صفحة العميل مرة واحدة حتى يُحفظ رمز QR على الجهاز.
3. افصل الإنترنت عن هاتف العميل وافتح «استلام أوردر» وتأكد أن QR ما زال يظهر.
4. من هاتف المندوب افتح الطلب واضغط «تسليم أوردر» وامسح QR.
5. إذا كان هاتف المندوب دون اتصال، أعد الإنترنت وتأكد أن عملية التسليم تزامنت وأصبحت الفاتورة `completed` مرة واحدة فقط.

## استعلامات تحقق سريعة

```sql
select id, full_name, phone_normalized, phone_verified_at, device_bound_at
from customers
order by id desc;

select order_number, status, updated_at, completed_at
from orders
order by created_at desc;

select order_id, token_value is not null as has_saved_qr, used_at, expires_at
from delivery_confirmation_tokens
order by created_at desc;

select order_id, previous_status, new_status, note, created_at
from order_status_history
order by created_at desc
limit 30;

select customer_id, order_id, provider, status, attempts, expires_at, verified_at
from customer_otp_challenges
order by created_at desc;
```
