using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Threading;
using System.Xml.Serialization;
using Forms = System.Windows.Forms;

namespace LumaWallpaper {
    public class Preferences {
        public string Scene = "Aquarium";
        public double Opacity = 0.72;
        public double Speed = 1.0;
        public double Density = 1.3;
        public bool QuietCenter = false;
        public static string PathName { get { return Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "settings.xml"); } }
        public static Preferences Load() {
            try { using (var s = File.OpenRead(PathName)) {
                var p = (Preferences)new XmlSerializer(typeof(Preferences)).Deserialize(s);
                p.Opacity = Clamp(p.Opacity, 0.08, 1.0, 0.72);
                p.Speed = Clamp(p.Speed, 0.15, 2.5, 1.0);
                p.Density = Clamp(p.Density, 0.5, 2.4, 1.3);
                if (Array.IndexOf(Art.Scenes, p.Scene) < 0) p.Scene = Art.Scenes[0];
                return p;
            }} catch { return new Preferences(); }
        }
        public static double Clamp(double n, double min, double max, double fallback) {
            return Double.IsNaN(n) || Double.IsInfinity(n) ? fallback : Math.Max(min, Math.Min(max, n));
        }
        public bool Save() {
            try { using (var s = File.Create(PathName)) new XmlSerializer(typeof(Preferences)).Serialize(s, this); return true; }
            catch { return false; }
        }
    }
    internal static class Native {
        internal delegate bool EnumProc(IntPtr hwnd, IntPtr param);
        [StructLayout(LayoutKind.Sequential)] internal struct Rect { public int Left, Top, Right, Bottom; }
        [StructLayout(LayoutKind.Sequential)] internal struct Point { public int X, Y; }
        [DllImport("user32.dll")] internal static extern bool EnumWindows(EnumProc cb, IntPtr p);
        [DllImport("user32.dll", CharSet=CharSet.Unicode)] internal static extern int GetWindowText(IntPtr h, System.Text.StringBuilder s, int n);
        [DllImport("user32.dll")] internal static extern bool IsWindowVisible(IntPtr h);
        [DllImport("user32.dll")] internal static extern bool IsWindow(IntPtr h);
        [DllImport("user32.dll")] internal static extern bool IsIconic(IntPtr h);
        [DllImport("user32.dll")] internal static extern bool GetClientRect(IntPtr h, out Rect r);
        [DllImport("user32.dll")] internal static extern bool ClientToScreen(IntPtr h, ref Point p);
        [DllImport("user32.dll")] internal static extern IntPtr GetForegroundWindow();
        [DllImport("user32.dll")] internal static extern IntPtr GetAncestor(IntPtr h, uint flags);
        [DllImport("user32.dll")] internal static extern bool SetForegroundWindow(IntPtr h);
        [DllImport("user32.dll")] internal static extern bool ShowWindow(IntPtr h, int command);
        [DllImport("user32.dll", EntryPoint="GetWindowLongPtrW")] internal static extern IntPtr GetWindowLongPtr(IntPtr h, int index);
        [DllImport("user32.dll", EntryPoint="SetWindowLongPtrW")] internal static extern IntPtr SetWindowLongPtr(IntPtr h, int index, IntPtr value);
        [DllImport("user32.dll")] internal static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int w, int height, uint flags);
        [DllImport("user32.dll")] internal static extern bool RegisterHotKey(IntPtr h, int id, uint mods, uint key);
        [DllImport("user32.dll")] internal static extern bool UnregisterHotKey(IntPtr h, int id);
        [DllImport("user32.dll")] internal static extern uint GetWindowThreadProcessId(IntPtr h, out uint id);
        internal static string Title(IntPtr h) { var b = new System.Text.StringBuilder(1024); GetWindowText(h,b,b.Capacity); return b.ToString(); }
        internal static bool Bounds(IntPtr h, out Rect result) {
            result = new Rect(); Rect r; var p = new Point();
            if (!GetClientRect(h, out r) || !ClientToScreen(h, ref p)) return false;
            result.Left=p.X; result.Top=p.Y; result.Right=p.X+r.Right; result.Bottom=p.Y+r.Bottom;
            return r.Right>0 && r.Bottom>0;
        }
    }
    internal class Target {
        public IntPtr Handle;
        public string Name;
        public override string ToString() { return Name; }
    }
    internal partial class Art : FrameworkElement {
        public static readonly string[] Scenes = { "Aquarium", "Pac-Man arcade", "Neon vortex", "Aurora rave", "Synthwave highway", "Rainbow jellyfish", "Koi pond", "Fireflies", "Star drift" };
        public Preferences Settings;
        public double Time;
        private readonly Typeface mono = new Typeface("Consolas");
        private readonly Dictionary<string, FormattedText> glyphs = new Dictionary<string, FormattedText>();
        public Art(Preferences settings) { Settings=settings; IsHitTestVisible=false; ClipToBounds=true; }
        private void Glyph(DrawingContext dc, string text, double x, double y, string color, double size, double alpha) {
            string key=text+color+size.ToString(CultureInfo.InvariantCulture);
            FormattedText ft;
            if (!glyphs.TryGetValue(key, out ft)) {
                var brush = (SolidColorBrush)new BrushConverter().ConvertFromString(color); brush.Freeze();
                ft = new FormattedText(text, CultureInfo.InvariantCulture, FlowDirection.LeftToRight, mono, size, brush, 1.0);
                glyphs[key]=ft;
            }
            double center = Settings.QuietCenter && x>ActualWidth*0.24 && x<ActualWidth*0.84 ? 0.12 : 1;
            dc.PushOpacity(alpha*Settings.Opacity*center);
            dc.DrawText(ft,new System.Windows.Point(x,y)); dc.Pop();
        }
        protected override void OnRender(DrawingContext dc) {
            double w=ActualWidth, h=ActualHeight, t=Time;
            if (w<1 || h<1) return;
            if (RenderLiving(dc,w,h,t) || RenderNeon(dc,w,h,t)) return;
            if (Settings.Scene=="Koi pond") {
                for (int i=0;i<30*Settings.Density;i++) {
                    double x=(i*173.3+Math.Sin(t*0.25+i)*18)%(w+30);
                    double y=(h+i*71.7-t*(5+i%3))%h; if(y<0)y+=h;
                    Glyph(dc,i%3==0?"~":"·",x,y,"#5FCFC4",16,0.34);
                }
                for (int i=0;i<7*Settings.Density;i++) {
                    double phase=t*(0.09+i*0.004)+i*1.04;
                    double cx=w*(0.5+0.45*Math.Cos(phase));
                    double cy=h*(0.48+0.36*Math.Sin(phase*1.37+i));
                    double angle=Math.Atan2(0.36*h*1.37*Math.Cos(phase*1.37+i),-0.45*w*Math.Sin(phase))*180/Math.PI;
                    dc.PushTransform(new RotateTransform(angle,cx,cy));
                    string[] fish={"           .:+:.", " :.    .:+#@@@#+:.", " :+#++###@@@@@@@##>", " :'    ':+#@@@#+:'", "           ':+:'"};
                    for(int row=0;row<fish.Length;row++)
                        Glyph(dc,fish[row],cx-68,cy-25+row*10,i%2==0?"#F5BA84":"#81DBD1",12,0.95);
                    dc.Pop();
                }
            } else if (Settings.Scene=="Fireflies") {
                for (int i=0;i<68*Settings.Density;i++) {
                    double x=(i*137.91)%w+Math.Sin(t*0.33+i*4)*22;
                    double y=(i*71.31)%h+Math.Cos(t*0.25+i)*25;
                    double pulse=0.25+0.75*Math.Pow((1+Math.Sin(t*0.9+i*2.73))/2,3);
                    Glyph(dc,i%7==0?"✦":(i%3==0?"+":"·"),x,y,i%4==0?"#D7F2B1":"#A2DDB4",i%7==0?19:15,pulse);
                }
            } else {
                for (int i=0;i<95*Settings.Density;i++) {
                    double x=(i*137.31+t*(2+i%4))%(w+30)-15;
                    double y=(i*83.77+Math.Sin(t*0.12+i)*9)%h;
                    Glyph(dc,i%13==0?"✧":(i%5==0?"+":"·"),x,y,i%5==0?"#D7C8FF":"#9FCCE8",i%13==0?21:14,0.35+0.65*(1+Math.Sin(t*0.6+i))/2);
                }
            }
        }
    }
    internal class Overlay : Window {
        internal Art Art;
        internal IntPtr Handle;
        internal Overlay(Preferences settings) {
            Title="Luma animation layer"; WindowStyle=WindowStyle.None; ResizeMode=ResizeMode.NoResize;
            AllowsTransparency=true; Background=Brushes.Transparent; ShowInTaskbar=false;
            ShowActivated=false; Focusable=false; IsHitTestVisible=false; Left=-20000; Top=-20000;
            Width=1; Height=1; Content=Art=new Art(settings);
            SourceInitialized += delegate {
                Handle=new WindowInteropHelper(this).Handle;
                long style=Native.GetWindowLongPtr(Handle,-20).ToInt64();
                Native.SetWindowLongPtr(Handle,-20,new IntPtr(style|0x20|0x80|0x08000000));
                HwndSource.FromHwnd(Handle).AddHook(delegate(IntPtr h,int msg,IntPtr wp,IntPtr lp,ref bool handled) {
                    if(msg==0x84) { handled=true; return new IntPtr(-1); }
                    if(msg==0x21) { handled=true; return new IntPtr(3); }
                    return IntPtr.Zero;
                });
            };
        }
    }
    internal class Controller : Window {
        private readonly Preferences prefs=Preferences.Load();
        private readonly Overlay overlay;
        private readonly DispatcherTimer tracker=new DispatcherTimer();
        private readonly DispatcherTimer renderer=new DispatcherTimer();
        private readonly Stopwatch watch=Stopwatch.StartNew();
        private readonly ComboBox targets=new ComboBox();
        private readonly TextBlock status=new TextBlock();
        private readonly Button pause=new Button();
        private readonly Forms.NotifyIcon tray=new Forms.NotifyIcon();
        private IntPtr target, handle;
        private uint targetPid;
        private bool enabled, paused, exiting;
        private bool hotkey;
        private double lastTime;
        private bool demo;
        private Window demoWindow;
        private Window previewWindow;
        internal Controller(bool demoMode) {
            demo=demoMode;
            Title="Luma 3 wallpaper controls"; Width=450; Height=810; MinWidth=430; MinHeight=620;
            WindowStartupLocation=WindowStartupLocation.CenterScreen; Background=Brush("#151124"); Foreground=Brush("#F4EBFF");
            FontFamily=new FontFamily("Segoe UI"); FontSize=14;
            overlay=new Overlay(prefs); overlay.Show(); overlay.Hide();
            var root=new StackPanel { Margin=new Thickness(28) }; Content=new ScrollViewer { Content=root, VerticalScrollBarVisibility=ScrollBarVisibility.Auto };
            root.Children.Add(new TextBlock { Text="LUMA 03 / LIVING WORLDS", FontSize=12, Foreground=Brush("#EEA0FF"), Margin=new Thickness(0,0,0,8) });
            root.Children.Add(new TextBlock { Text="An entire world in motion.", FontSize=26, FontWeight=FontWeights.SemiBold, TextWrapping=TextWrapping.Wrap });
            root.Children.Add(new TextBlock { Text="Swim with tropical fish or watch an arcade chase play itself. Nine scenes, all click-through.", TextWrapping=TextWrapping.Wrap, Foreground=Brush("#B8ABC9"), Margin=new Thickness(0,10,0,18) });
            Label(root,"ATTACH TO WINDOW");
            targets.Height=32; root.Children.Add(targets);
            var refresh=MakeButton("Refresh windows",delegate { RefreshTargets(); }); refresh.Margin=new Thickness(0,6,0,16); root.Children.Add(refresh);
            Label(root,"SCENE");
            var scenes=new ComboBox { ItemsSource=Art.Scenes, SelectedItem=prefs.Scene, Height=32 };
            scenes.SelectionChanged += delegate { if(scenes.SelectedItem!=null)prefs.Scene=(string)scenes.SelectedItem; overlay.Art.InvalidateVisual(); }; root.Children.Add(scenes);
            var visibility=AddSlider(root,"Visibility",prefs.Opacity,0.08,1.0,delegate(double v) { prefs.Opacity=v; },true);
            var speed=AddSlider(root,"Motion speed",prefs.Speed,0.15,2.5,delegate(double v) { prefs.Speed=v; },false);
            var density=AddSlider(root,"Scene density",prefs.Density,0.5,2.4,delegate(double v) { prefs.Density=v; },false);
            var quiet=new CheckBox { Content="Keep the middle of the chat quiet", IsChecked=prefs.QuietCenter, Margin=new Thickness(0,14,0,12), Foreground=Foreground };
            quiet.Checked+=delegate {prefs.QuietCenter=true;}; quiet.Unchecked+=delegate{prefs.QuietCenter=false;}; root.Children.Add(quiet);
            var presets=new UniformGridCompat();
            presets.Children.Add(MakeButton("Go wild",delegate { visibility.Value=0.88; speed.Value=1.25; density.Value=1.8; quiet.IsChecked=false; }));
            presets.Children.Add(MakeButton("Readable",delegate { visibility.Value=0.45; speed.Value=0.75; density.Value=1.0; quiet.IsChecked=true; }));
            presets.Children.Add(MakeButton("Preview",delegate { OpenPreview(); })); root.Children.Add(presets);
            root.Children.Add(MakeButton("Start wallpaper",delegate { Start(); }));
            var row=new UniformGridCompat();
            pause.Content="Pause"; StyleButton(pause); pause.Click+=delegate { paused=!paused; pause.Content=paused?"Resume":"Pause"; UpdateVisibility(); };
            row.Children.Add(pause); row.Children.Add(MakeButton("Stop",delegate { enabled=false; UpdateVisibility(); status.Text="Stopped. Start wallpaper to attach again."; }));
            row.Children.Add(MakeButton("Quit",delegate { Exit(); })); root.Children.Add(row);
            status.Text="Choose ChatGPT above, then start."; status.TextWrapping=TextWrapping.Wrap; status.Foreground=Brush("#9CAFB1"); status.Margin=new Thickness(0,14,0,0); root.Children.Add(status);
            root.Children.Add(new TextBlock { Text="Ctrl + Alt + Shift + W: show/hide wallpaper\nTray icon: controls or quit. No app files are changed.", TextWrapping=TextWrapping.Wrap, Foreground=Brush("#7E9599"), FontSize=12, Margin=new Thickness(0,12,0,0) });
            SourceInitialized+=delegate {
                handle=new WindowInteropHelper(this).Handle;
                hotkey=Native.RegisterHotKey(handle,41,0x4000|1|2|4,0x57);
                HwndSource.FromHwnd(handle).AddHook(delegate(IntPtr h,int msg,IntPtr wp,IntPtr lp,ref bool handled) {
                    if(msg==0x312 && wp.ToInt32()==41) { paused=!paused; pause.Content=paused?"Resume":"Pause"; UpdateVisibility(); handled=true; }
                    return IntPtr.Zero;
                });
                if(!hotkey)status.Text="Shortcut unavailable; use the Luma tray icon to pause or quit.";
            };
            Loaded+=delegate { if(demo)OpenDemo(); RefreshTargets(); };
            Closing+=delegate(object sender,System.ComponentModel.CancelEventArgs e) {
                if(!exiting) { e.Cancel=true; Hide(); if(!prefs.Save()) ShowSaveWarning(); }
            };
            tray.Icon=System.Drawing.SystemIcons.Application; tray.Text="Luma 3 wallpaper — double-click for controls";
            var menu=new Forms.ContextMenuStrip();
            menu.Items.Add("Open controls",null,delegate { Dispatcher.Invoke(new Action(OpenControls)); });
            menu.Items.Add("Pause / resume",null,delegate { Dispatcher.Invoke(new Action(delegate { paused=!paused; pause.Content=paused?"Resume":"Pause"; UpdateVisibility(); })); });
            menu.Items.Add("Quit Luma",null,delegate { Dispatcher.Invoke(new Action(Exit)); });
            tray.ContextMenuStrip=menu; tray.DoubleClick+=delegate { Dispatcher.Invoke(new Action(OpenControls)); }; tray.Visible=true;
            tracker.Interval=TimeSpan.FromMilliseconds(100); tracker.Tick+=delegate { UpdateVisibility(); }; tracker.Start();
            renderer.Interval=TimeSpan.FromMilliseconds(33); renderer.Tick+=delegate {
                double now=watch.Elapsed.TotalSeconds; double delta=Math.Min(0.1,now-lastTime); lastTime=now;
                if(overlay.IsVisible && !paused) { overlay.Art.Time+=delta*prefs.Speed; overlay.Art.InvalidateVisual(); }
            };
        }
        private static SolidColorBrush Brush(string s) { return (SolidColorBrush)new BrushConverter().ConvertFromString(s); }
        private void Label(StackPanel p,string t) { p.Children.Add(new TextBlock { Text=t, FontSize=11, Foreground=Brush("#99B3B0"), Margin=new Thickness(0,0,0,7) }); }
        private Button MakeButton(string text, Action action) { var b=new Button { Content=text }; StyleButton(b); b.Click+=delegate{action();}; return b; }
        private void StyleButton(Button b) { b.Padding=new Thickness(12,7,12,7); b.Margin=new Thickness(0,4,4,0); b.Background=Brush("#DEB6FF"); b.Foreground=Brush("#251139"); b.BorderThickness=new Thickness(0); }
        private Slider AddSlider(StackPanel root,string name,double value,double min,double max,Action<double> change,bool percent) {
            var label=new TextBlock { Margin=new Thickness(0,16,0,4), Foreground=Brush("#C1D1CF") }; root.Children.Add(label);
            Action<double> update=delegate(double v) { label.Text=name+"  "+(percent?(v*100).ToString("0")+"%":v.ToString("0.00")+"×"); change(v); };
            var s=new Slider { Minimum=min,Maximum=max,Value=value,SmallChange=percent?0.02:0.05,LargeChange=percent?0.1:0.2 };
            s.ValueChanged+=delegate { update(s.Value); overlay.Art.InvalidateVisual(); }; update(value); root.Children.Add(s);
            return s;
        }
        private void RefreshTargets() {
            var list=new List<Target>();
            Native.EnumWindows(delegate(IntPtr h,IntPtr p) {
                if(!Native.IsWindowVisible(h))return true;
                string title=Native.Title(h); uint pid; Native.GetWindowThreadProcessId(h,out pid);
                if(String.IsNullOrWhiteSpace(title) || (pid==(uint)Process.GetCurrentProcess().Id && (!demo || title!="Luma test surface")))return true;
                list.Add(new Target{ Handle=h,Name=title }); return true;
            },IntPtr.Zero);
            list.Sort(delegate(Target a,Target b) { return String.Compare(a.Name,b.Name,StringComparison.OrdinalIgnoreCase); });
            targets.ItemsSource=list; Target selected=list.Find(delegate(Target x){return x.Handle==target;});
            if(selected==null)selected=list.Find(delegate(Target x){return demo?x.Name=="Luma test surface":x.Name.IndexOf("ChatGPT",StringComparison.OrdinalIgnoreCase)>=0;});
            if(selected!=null)targets.SelectedItem=selected;
            if(list.Count==0)status.Text="No visible app windows found. Open ChatGPT, then refresh.";
        }
        private void Start() {
            var choice=targets.SelectedItem as Target;
            if(choice==null || !Native.IsWindow(choice.Handle)) { status.Text="Select an open window first. Refresh if ChatGPT has restarted.";return; }
            target=choice.Handle; Native.GetWindowThreadProcessId(target,out targetPid); enabled=true; paused=false; pause.Content="Pause";
            bool saved=prefs.Save(); status.Text="Attached to "+choice.Name+". Use the tray icon for controls.";
            if(!saved)ShowSaveWarning();
            Hide(); if(Native.IsIconic(target))Native.ShowWindow(target,9); Native.SetForegroundWindow(target); UpdateVisibility();
        }
        private void ShowSaveWarning() { tray.ShowBalloonTip(4000,"Luma settings","Settings could not be saved. Keep Luma in a writable folder.",Forms.ToolTipIcon.Warning); }
        private void UpdateVisibility() {
            uint currentPid=0;
            if(target!=IntPtr.Zero)Native.GetWindowThreadProcessId(target,out currentPid);
            bool valid=target!=IntPtr.Zero && Native.IsWindow(target) && currentPid==targetPid;
            if(enabled && !valid) { enabled=false; status.Text="The attached window closed. Refresh windows and start again."; }
            IntPtr foreground=Native.GetForegroundWindow();
            bool active=foreground==target || (foreground!=IntPtr.Zero && Native.GetAncestor(foreground,3)==target);
            Native.Rect r;
            if(!enabled || paused || !valid || !active || Native.IsIconic(target) || !Native.IsWindowVisible(target) || !Native.Bounds(target,out r)) {
                renderer.Stop(); if(overlay.IsVisible)overlay.Hide(); return;
            }
            if(!overlay.IsVisible)overlay.Show();
            if(!renderer.IsEnabled) { lastTime=watch.Elapsed.TotalSeconds; renderer.Start(); }
            Native.SetWindowPos(overlay.Handle,new IntPtr(-1),r.Left,r.Top,r.Right-r.Left,r.Bottom-r.Top,0x10|0x40);
        }
        private void OpenControls() { Show(); WindowState=WindowState.Normal; Activate(); }
        private void OpenPreview() {
            if(previewWindow!=null) { previewWindow.Activate(); return; }
            var art=new Art(prefs);
            var preview=new Window { Title="Luma 3 — live scene preview", Width=1000, Height=650, MinWidth=400, MinHeight=300, Background=Brush("#100D20"), Content=art };
            previewWindow=preview;
            var timer=new DispatcherTimer { Interval=TimeSpan.FromMilliseconds(33) };
            var elapsed=Stopwatch.StartNew(); double last=0;
            timer.Tick+=delegate { double now=elapsed.Elapsed.TotalSeconds; double dt=Math.Min(0.1,now-last); last=now;
                if(preview.WindowState!=WindowState.Minimized) { art.Time+=dt*prefs.Speed; art.InvalidateVisual(); }
            };
            preview.Closed+=delegate { timer.Stop(); previewWindow=null; };
            preview.Show(); timer.Start();
        }
        private void Exit() {
            if(exiting)return; exiting=true; enabled=false; tracker.Stop(); renderer.Stop();
            Native.UnregisterHotKey(handle,41); prefs.Save(); tray.Visible=false; tray.Dispose(); overlay.Close();
            if(demoWindow!=null)demoWindow.Close(); Application.Current.Shutdown();
        }
        private void OpenDemo() {
            var panel=new StackPanel { Margin=new Thickness(50) };
            demoWindow=new Window { Title="Luma test surface",Width=1050,Height=680,Background=Brush("#17242A"),Foreground=Brushes.White,Content=panel,WindowStartupLocation=WindowStartupLocation.CenterScreen };
            panel.Children.Add(new TextBlock {Text="Overlay verification",FontSize=28,Margin=new Thickness(0,0,0,24)});
            panel.Children.Add(new TextBlock {Text="This is a local test window, not ChatGPT.\nThe overlay must let you type and click normally.",FontSize=18,Margin=new Thickness(0,0,0,22)});
            var input=new TextBox {Height=50,FontSize=20,Text="Type here to verify click-through"};panel.Children.Add(input);
            int count=0; var b=new Button {Content="Click-through count: 0",Width=240,Height=48,Margin=new Thickness(0,20,0,0)};
            b.Click+=delegate { count++;b.Content="Click-through count: "+count; }; panel.Children.Add(b);
            demoWindow.Show(); Activate();
        }
    }
    internal class UniformGridCompat : System.Windows.Controls.Primitives.UniformGrid { internal UniformGridCompat() { Rows=1; Margin=new Thickness(0,4,0,0); } }
    internal static class Program {
        [STAThread] public static int Main(string[] args) {
            bool demo=Array.IndexOf(args,"--demo")>=0;
#if DEMO
            demo=true;
#endif
            bool own;
            using(var mutex=new Mutex(true,"Local\\LumaWallpaper"+(demo?"Demo":""),out own)) {
                if(!own) { MessageBox.Show("Luma is already running. To upgrade, quit the old version from its tray menu, then open this version again.","Luma 3");return 0; }
                try {
                    var app=new Application { ShutdownMode=ShutdownMode.OnExplicitShutdown };
                    app.DispatcherUnhandledException+=delegate(object s,DispatcherUnhandledExceptionEventArgs e) {
                        MessageBox.Show(e.Exception.Message,"Luma stopped"); app.Shutdown(1); e.Handled=true;
                    };
                    app.Run(new Controller(demo)); return 0;
                } catch(Exception e) { MessageBox.Show(e.Message,"Luma could not start");return 1; }
            }
        }
    }
}
