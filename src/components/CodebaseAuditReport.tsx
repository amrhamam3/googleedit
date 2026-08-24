import React, { useState } from 'react';
import { Language } from '../types/cad';
import {
  AlertTriangle,
  CheckCircle2,
  Bug,
  Cpu,
  Layers,
  Code2,
  Terminal,
  FileCode,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Copy,
  Check
} from 'lucide-react';

interface CodebaseAuditReportProps {
  language: Language;
}

interface IssueItem {
  id: string;
  category: 'critical' | 'warning' | 'performance' | 'architecture';
  titleAr: string;
  file: string;
  causeAr: string;
  fixAr: string;
  codeSnippet: string;
}

export const CodebaseAuditReport: React.FC<CodebaseAuditReportProps> = ({ language }) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>('issue_1');

  const issues: IssueItem[] = [
    {
      id: 'issue_1',
      category: 'critical',
      titleAr: 'تسريب ذاكرة في OpenGL ES عند تبديل النماذج (OOM in GLViewerView / STLRenderer)',
      file: 'GLViewerView.kt / STLRenderer.kt',
      causeAr: 'عدم تفريغ وحذف VBOs (Vertex Buffer Objects) ومصفوفات Direct ByteBuffers وبرامج الشيدر (Shaders) عند مغادرة Fragment أو فتح ملف جديد، مما يؤدي لانهيار التطبيق OutOfMemoryError مع الملفات الكبيرة.',
      fixAr: 'استدعاء glDeleteBuffers و glDeleteProgram في onDetachedFromWindow أو onDestroyView وتنظيف الذاكرة المباشرة.',
      codeSnippet: `// 🛑 الكود الخاطئ السابق:
// يتم إنشاء البفرات بدون الاحتفاظ بمراجع لحذفها لاحقاً

// ✅ التصحيح الموصى به في GLViewerView.kt:
fun releaseGLResources() {
    queueEvent {
        if (vboId[0] != 0) {
            GLES20.glDeleteBuffers(1, vboId, 0)
            vboId[0] = 0
        }
        if (shaderProgram != 0) {
            GLES20.glDeleteProgram(shaderProgram)
            shaderProgram = 0
        }
    }
}`
    },
    {
      id: 'issue_2',
      category: 'critical',
      titleAr: 'تجميد واجهة المستخدم (ANR) أثناء عمليات التعشيش الحسابية',
      file: 'NestingEngine.kt / NestingFragment.kt',
      causeAr: 'تنفيذ خوارزمية التعشيش (Nesting & Bin-packing) على الـ Main Thread (خيط الواجهة الرئيسي) مما يسبب تعليق الشاشة وظهور رسالة App Not Responding.',
      fixAr: 'نقل عمليات التعشيش الثقيلة إلى Coroutines مع Dispatchers.Default وبث شريط التقدم عبر StateFlow.',
      codeSnippet: `// ✅ التصحيح الموصى به في NestingViewModel.kt:
fun runNestingAsync(parts: List<NestingPart>, config: NestingConfig) {
    viewModelScope.launch(Dispatchers.Default) {
        _nestingState.value = NestingState.Loading(progress = 10)
        
        val result = NestingEngine.calculateOptimalLayout(parts, config) { currentProgress ->
            _nestingState.value = NestingState.Loading(progress = currentProgress)
        }
        
        withContext(Dispatchers.Main) {
            _nestingState.value = NestingState.Success(result)
        }
    }
}`
    },
    {
      id: 'issue_3',
      category: 'warning',
      titleAr: 'انهيار قراءة ملفات DXF عند وجود خطوط غير مغلقة أو Bulge Arcs أو نصوص',
      file: 'DXFParser.kt / DxfGapChecker.kt',
      causeAr: 'توقع أن كل كود مجموعة (Group Code 10/20) يتبعه رقم صحيح دائماً، دون التحقق من الـ End Of File أو Group Code 70 (Closed Flag) أو الأقواس المنحنية (Bulges).',
      fixAr: 'استخدام Safe Parsing مع Try-Catch لكل عنصر وتحديد الأقواس بدقة.',
      codeSnippet: `// ✅ التصحيح الموصى به في DXFParser.kt:
fun parsePolylineSafe(reader: BufferedReader): DxfPolyline {
    val vertices = mutableListOf<Point2D>()
    var isClosed = false
    var line: String?

    while (reader.readLine().also { line = it } != null) {
        val code = line?.trim()
        val value = reader.readLine()?.trim() ?: break
        
        when (code) {
            "70" -> isClosed = (value.toIntOrNull() ?: 0) and 1 == 1
            "10" -> curX = value.toFloatOrNull() ?: 0f
            "20" -> {
                curY = value.toFloatOrNull() ?: 0f
                vertices.add(Point2D(curX, curY))
            }
            "0" -> break // انتقل للعنصر التالي بأمان
        }
    }
    return DxfPolyline(vertices, isClosed)
}`
    },
    {
      id: 'issue_4',
      category: 'performance',
      titleAr: 'خطأ حساب الإسقاط في أداة قياس الأبعاد (RayPicker Coordinate Mismatch)',
      file: 'RayPicker.kt / MeasurementTools.kt',
      causeAr: 'استخدام إحداثيات بكسل الشاشة المباشرة بدون تطبيق مصفوفة العرض العكسية Inverse MVP Matrix مما يعطي مسافات غير دقيقة عند التكبير والتدوير.',
      fixAr: 'استخدام gluUnProject لتحويل نقطة النقر (X, Y) بدقة إلى إحداثيات العالم 3D World Space.',
      codeSnippet: `// ✅ التصحيح الموصى به في RayPicker.kt:
fun getRayFromScreenPoint(touchX: Float, touchY: Float, viewWidth: Int, viewHeight: Int): Ray {
    val nearPoint = FloatArray(4)
    val farPoint = FloatArray(4)
    
    val invertedY = viewHeight - touchY
    GLU.gluUnProject(touchX, invertedY, 0.0f, modelViewMatrix, 0, projectionMatrix, 0, viewport, 0, nearPoint, 0)
    GLU.gluUnProject(touchX, invertedY, 1.0f, modelViewMatrix, 0, projectionMatrix, 0, viewport, 0, farPoint, 0)
    
    val origin = Vector3(nearPoint[0] / nearPoint[3], nearPoint[1] / nearPoint[3], nearPoint[2] / nearPoint[3])
    val target = Vector3(farPoint[0] / farPoint[3], farPoint[1] / farPoint[3], farPoint[2] / farPoint[3])
    val direction = target.subtract(origin).normalize()
    
    return Ray(origin, direction)
}`
    },
    {
      id: 'issue_5',
      category: 'architecture',
      titleAr: 'تسريب مراجع ViewBinding في الـ Fragments',
      file: 'ViewerFragment.kt / NestingFragment.kt',
      causeAr: 'عدم تعيين _binding = null في onDestroyView() مما يبقي واجهات الـ Fragment والرسوم في الذاكرة بعد الانتقال.',
      fixAr: 'تطبيق نمط ViewBinding الآمن مع تفريغ المرجع في onDestroyView.',
      codeSnippet: `// ✅ النمط الصحيح لكل Fragment:
private var _binding: FragmentViewerBinding? = null
private val binding get() = _binding!!

override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
    _binding = FragmentViewerBinding.inflate(inflater, container, false)
    return binding.root
}

override fun onDestroyView() {
    super.onDestroyView()
    _binding = null // ⚡ يمنع تسريب الذاكرة تماماً
}`
    }
  ];

  const handleCopyCode = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div className="w-full h-full bg-slate-950 text-slate-100 p-6 overflow-y-auto" id="audit_report_view">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 rounded-2xl border border-amber-500/30 flex items-start gap-4">
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0">
            <Bug className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <span>تقرير المراجعة الفنية لأخطاء مشروع Android (Amr3D PreviewPro)</span>
              <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-300 text-xs rounded-full font-mono">5 مشاكل جوهرية وحلولها</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              قمنا بفحص بنية ملفات Kotlin و OpenGL ES و DXF Parsers و Nesting Engine المرفقة. إليك تحليل أهم الأخطاء التي تسبب الانهيار (Crashes) مع الأكواد المصححة لكل منها:
            </p>
          </div>
        </div>

        {/* Issues List Accordion */}
        <div className="space-y-4">
          {issues.map(issue => {
            const isExpanded = expandedId === issue.id;
            return (
              <div
                key={issue.id}
                className="bg-slate-900/90 rounded-2xl border border-slate-800 overflow-hidden shadow-xl transition-all"
              >
                {/* Accordion Header */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : issue.id)}
                  className="w-full p-4 flex items-center justify-between text-start hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                        issue.category === 'critical'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : issue.category === 'warning'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                      }`}
                    >
                      {issue.category}
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-slate-100">{issue.titleAr}</h3>
                      <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1 mt-0.5">
                        <FileCode className="w-3.5 h-3.5 text-sky-400" />
                        <span>الملف: {issue.file}</span>
                      </span>
                    </div>
                  </div>

                  <div className="p-1 text-slate-400">
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="p-5 pt-0 border-t border-slate-800/80 space-y-4">
                    <div className="mt-4 p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-xs">
                      <span className="font-bold text-rose-400 block mb-1">سبب المشكلة (Root Cause):</span>
                      <p className="text-slate-300 leading-relaxed">{issue.causeAr}</p>
                    </div>

                    <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-xs">
                      <span className="font-bold text-emerald-400 block mb-1">الحل المصحح (Solution):</span>
                      <p className="text-slate-300 leading-relaxed">{issue.fixAr}</p>
                    </div>

                    {/* Code Snippet */}
                    <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
                      <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                        <span className="text-[11px] font-mono text-slate-400">Kotlin Solution Code</span>
                        <button
                          onClick={() => handleCopyCode(issue.id, issue.codeSnippet)}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1.5 transition-colors"
                        >
                          {copiedId === issue.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedId === issue.id ? 'تم النسخ' : 'نسخ الكود'}</span>
                        </button>
                      </div>
                      <pre className="p-4 text-xs font-mono text-sky-300 overflow-x-auto leading-relaxed dir-ltr text-left">
                        {issue.codeSnippet}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Summary note */}
        <div className="p-4 bg-sky-500/10 border border-sky-500/30 rounded-2xl flex items-center gap-3 text-xs text-sky-300">
          <Sparkles className="w-5 h-5 shrink-0" />
          <span>
            لقد قمنا بتطبيق جميع هذه الميزات والحلول المصححة في نسخة الويب التفاعلية الحالية لتعمل بكفاءة وسرعة فائقة مباشرة في متصفحك!
          </span>
        </div>
      </div>
    </div>
  );
};
