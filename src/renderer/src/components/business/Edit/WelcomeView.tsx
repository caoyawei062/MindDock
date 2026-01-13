import { FileText, CodeXml, Sparkles, Shield, Keyboard } from 'lucide-react'
import logoSrc from '@/assets/logo.png'

const WelcomeView: React.FC = () => {
    const features = [
        {
            icon: FileText,
            title: '富文本编辑',
            description: '支持 Markdown 语法，实时预览'
        },
        {
            icon: CodeXml,
            title: '代码片段',
            description: '语法高亮，多语言支持'
        },
        {
            icon: Keyboard,
            title: '快捷操作',
            description: '托盘快速访问，一键复制'
        },
        {
            icon: Shield,
            title: '本地存储',
            description: '数据安全，隐私优先'
        }
    ]

    return (
        <div className="h-full flex flex-col items-center justify-center p-8">
            {/* Logo 和标题 */}
            <div className="flex flex-col items-center mb-12">
                <div className="relative mb-6">
                    <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full" />
                    <img
                        src={logoSrc}
                        alt="MindDock Logo"
                        className="relative size-20 rounded-2xl shadow-lg"
                    />
                </div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent mb-2">
                    MindDock
                </h1>
                <p className="text-muted-foreground text-center max-w-md">
                    轻量级知识管理工具，让创意和代码触手可及
                </p>
            </div>

            {/* 特性网格 */}
            <div className="grid grid-cols-2 gap-4 max-w-lg mb-12">
                {features.map((feature, index) => (
                    <div
                        key={index}
                        className="group p-4 rounded-xl bg-muted/30 border border-border/50 hover:bg-muted/50 hover:border-border transition-all duration-200"
                    >
                        <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                                <feature.icon size={18} />
                            </div>
                            <div>
                                <h3 className="font-medium text-sm mb-1">{feature.title}</h3>
                                <p className="text-xs text-muted-foreground">{feature.description}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* 快速开始提示 */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Sparkles size={14} className="text-primary" />
                <span>从左侧列表选择一个文档开始编辑</span>
            </div>

            {/* 快捷键提示 */}
            <div className="mt-6 flex items-center gap-4 text-xs text-muted-foreground/70">
                <div className="flex items-center gap-1.5">
                    <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px]">⌘</kbd>
                    <span>+</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px]">N</kbd>
                    <span>新建文档</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px]">⌘</kbd>
                    <span>+</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px]">K</kbd>
                    <span>快速搜索</span>
                </div>
            </div>
        </div>
    )
}

export default WelcomeView
