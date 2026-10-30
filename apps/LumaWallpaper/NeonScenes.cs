using System;
using System.Windows;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Collections.Generic;

namespace LumaWallpaper {
    internal partial class Art {
        private static readonly string[] spectrum = { "#FF3FCF", "#A75BFF", "#627BFF", "#27DFFF", "#38FFD1", "#BAFF5C", "#FFD264", "#FF795F" };
        private static readonly SolidColorBrush[] colors = MakeColors();
        private static readonly RadialGradientBrush[] glows = MakeGlows();
        private static readonly Pen[] thinPens = MakePens(1.6);
        private static readonly Pen[] boldPens = MakePens(3.5);
        private static readonly Pen[] haloPens = MakePens(13);
        private static readonly Pen[] ribbonPens = MakePens(36);
        private static readonly Brush quietMask = MakeQuietMask();
        private static readonly Dictionary<string,Pen> alphaPens = new Dictionary<string,Pen>();
        private static readonly Dictionary<string,SolidColorBrush> alphaBrushes = new Dictionary<string,SolidColorBrush>();
        private static readonly Dictionary<string,BitmapSource> glowSprites = new Dictionary<string,BitmapSource>();
        private static SolidColorBrush Tint(int color,double opacity) {
            color%=8;int alpha=(int)(Math.Max(0,Math.Min(1,opacity))*255);
            string key=color+":"+alpha;SolidColorBrush b;
            if(!alphaBrushes.TryGetValue(key,out b)) { Color c=colors[color].Color;b=new SolidColorBrush(Color.FromArgb((byte)alpha,c.R,c.G,c.B));b.Freeze();alphaBrushes[key]=b; }
            return b;
        }
        private static Pen Stroke(int color,double width,double opacity) {
            int alpha=(int)(Math.Max(0,Math.Min(1,opacity))*255);
            string key=color%8+":"+width.ToString(System.Globalization.CultureInfo.InvariantCulture)+":"+alpha;Pen p;
            if(!alphaPens.TryGetValue(key,out p)) {p=new Pen(Tint(color,opacity),width){StartLineCap=PenLineCap.Round,EndLineCap=PenLineCap.Round,LineJoin=PenLineJoin.Round};p.Freeze();alphaPens[key]=p;}
            return p;
        }
        private static double Scatter(int index,int seed) { return Frac(Math.Sin(index*127.1+seed*311.7)*43758.5453); }
        private static SolidColorBrush[] MakeColors() {
            var result=new SolidColorBrush[spectrum.Length];
            for(int i=0;i<result.Length;i++){ result[i]=(SolidColorBrush)new BrushConverter().ConvertFromString(spectrum[i]);result[i].Freeze(); }
            return result;
        }
        private static RadialGradientBrush[] MakeGlows() {
            var result=new RadialGradientBrush[colors.Length];
            for(int i=0;i<result.Length;i++) {
                Color c=colors[i].Color;
                var b=new RadialGradientBrush();
                b.GradientStops.Add(new GradientStop(Color.FromArgb(210,c.R,c.G,c.B),0));
                b.GradientStops.Add(new GradientStop(Color.FromArgb(70,c.R,c.G,c.B),0.38));
                b.GradientStops.Add(new GradientStop(Color.FromArgb(0,c.R,c.G,c.B),1));
                b.Freeze();result[i]=b;
            }
            return result;
        }
        private static Pen[] MakePens(double width) {
            var result=new Pen[colors.Length];
            for(int i=0;i<result.Length;i++){var p=new Pen(colors[i],width){StartLineCap=PenLineCap.Round,EndLineCap=PenLineCap.Round,LineJoin=PenLineJoin.Round};p.Freeze();result[i]=p;}
            return result;
        }
        private static Brush MakeQuietMask() {
            var b=new LinearGradientBrush { StartPoint=new Point(0,0.5),EndPoint=new Point(1,0.5) };
            b.GradientStops.Add(new GradientStop(Colors.White,0)); b.GradientStops.Add(new GradientStop(Colors.White,0.20));
            b.GradientStops.Add(new GradientStop(Color.FromArgb(31,255,255,255),0.30));
            b.GradientStops.Add(new GradientStop(Color.FromArgb(31,255,255,255),0.80));
            b.GradientStops.Add(new GradientStop(Colors.White,0.90)); b.GradientStops.Add(new GradientStop(Colors.White,1));
            b.Freeze();return b;
        }
        private static double Frac(double v) { return v-Math.Floor(v); }
        private static Point Polar(double x,double y,double radius,double angle) { return new Point(x+radius*Math.Cos(angle),y+radius*Math.Sin(angle)); }
        private void Glow(DrawingContext dc,double x,double y,double radius,int color,double opacity) {
            color%=8;int opacityByte=(int)(opacity*255);string key=color+":"+opacityByte;BitmapSource sprite;
            if(!glowSprites.TryGetValue(key,out sprite)) {
                const int size=96;var pixels=new byte[size*size*4];Color c=colors[color].Color;
                for(int py=0;py<size;py++)for(int px=0;px<size;px++) {
                    double dx=(px+0.5)/size*2-1,dy=(py+0.5)/size*2-1,r=Math.Sqrt(dx*dx+dy*dy);
                    double falloff=r<0.38?(210-(140*r/0.38)):(70*Math.Max(0,1-(r-0.38)/0.62));
                    int a=(int)(falloff*opacity);int offset=(py*size+px)*4;
                    pixels[offset]=(byte)(c.B*a/255);pixels[offset+1]=(byte)(c.G*a/255);pixels[offset+2]=(byte)(c.R*a/255);pixels[offset+3]=(byte)a;
                }
                sprite=BitmapSource.Create(size,size,96,96,PixelFormats.Pbgra32,null,pixels,size*4);sprite.Freeze();glowSprites[key]=sprite;
            }
            dc.DrawImage(sprite,new Rect(x-radius,y-radius,radius*2,radius*2));
        }
        private static StreamGeometry Path(Point[] points,bool closed) {
            var g=new StreamGeometry();
            using(var c=g.Open()){c.BeginFigure(points[0],closed,closed);for(int i=1;i<points.Length;i++)c.LineTo(points[i],true,false);}
            g.Freeze();return g;
        }
        private void NeonPath(DrawingContext dc,Geometry geometry,int color,double opacity) {
            color%=8;
            dc.DrawGeometry(null,Stroke(color,13,opacity*0.12),geometry);
            dc.DrawGeometry(null,Stroke(color,1.6,opacity),geometry);
        }
        private bool RenderNeon(DrawingContext dc,double w,double h,double t) {
            int scene=Array.IndexOf(new[]{"Neon vortex","Aurora rave","Synthwave highway","Rainbow jellyfish"},Settings.Scene);
            if(scene<0 || scene>3)return false;
            dc.PushOpacity(Settings.Opacity);
            if(Settings.QuietCenter)dc.PushOpacityMask(quietMask);
            if(scene==0)Vortex(dc,w,h,t);
            else if(scene==1)Aurora(dc,w,h,t);
            else if(scene==2)Synthwave(dc,w,h,t);
            else Jellyfish(dc,w,h,t);
            if(Settings.QuietCenter)dc.Pop();
            dc.Pop();return true;
        }
        private void Vortex(DrawingContext dc,double w,double h,double t) {
            double cx=w*(0.5+0.06*Math.Sin(t*0.16)),cy=h*(0.48+0.05*Math.Cos(t*0.13));
            double radius=Math.Sqrt(w*w+h*h)*0.55;
            Glow(dc,w*0.15,h*0.2,h*0.43,0,0.32);Glow(dc,w*0.86,h*0.76,h*0.48,3,0.3);
            Glow(dc,cx,cy,h*0.26,1,0.45);
            int arms=(int)(9+Settings.Density*4);
            for(int arm=0;arm<arms;arm++) {
                var points=new Point[80];
                for(int k=0;k<points.Length;k++) {
                    double p=(k+3.0)/(points.Length+2),r=radius*p;
                    double a=arm*Math.PI*2/arms+t*0.26+Math.Log(p+0.04)*1.65;
                    points[k]=Polar(cx,cy,r,a);
                }
                NeonPath(dc,Path(points,false),arm,0.65);
            }
            int count=(int)(145*Settings.Density);
            for(int i=0;i<count;i++) {
                double p=Frac(Scatter(i,1)+t*(0.035+(i%5)*0.004));
                double a=Scatter(i,2)*Math.PI*2+t*0.12+Math.Log(p+0.04)*1.65;
                Point at=Polar(cx,cy,(0.05+p)*radius,a);
                double size=1.5+p*3.8;
                if(i%4==0)Glow(dc,at.X,at.Y,size*5,i,0.5);
                dc.DrawEllipse(colors[i%8],null,at,size,size);
                if(i%7==0) {
                    Point back=Polar(cx,cy,Math.Max(0,p-0.09)*radius,a-0.10);
                    dc.DrawLine(Stroke(i,1.6,0.5),back,at);
                }
            }
            for(int ring=0;ring<5;ring++) {
                double r=(0.07+ring*0.075)*Math.Min(w,h);
                var pts=new Point[64];
                for(int k=0;k<pts.Length;k++) {
                    double a=k*Math.PI*2/63+t*(ring%2==0?0.25:-0.2);
                    pts[k]=Polar(cx,cy,r*(1+0.035*Math.Sin(a*6+t)),a);
                }
                NeonPath(dc,Path(pts,false),ring*2,0.6);
            }
        }
        private void Aurora(DrawingContext dc,double w,double h,double t) {
            Glow(dc,w*0.1,h*0.4,h*0.65,4,0.26);Glow(dc,w*0.85,h*0.5,h*0.65,0,0.30);
            int ribbons=(int)(6+Settings.Density*3);
            for(int j=0;j<ribbons;j++) {
                var points=new Point[90];
                for(int k=0;k<90;k++) {
                    double x=w*k/89.0;
                    double y=h*(0.48+0.23*Math.Sin(x/w*5.0+t*0.36+j*0.43)+0.12*Math.Sin(x/w*9-t*0.22+j*0.19));
                    y+=(j-ribbons/2.0)*h*0.022;
                    points[k]=new Point(x,y);
                }
                Geometry g=Path(points,false);int color=(j+3)%8;
                dc.DrawGeometry(null,Stroke(color,36,0.075),g);
                dc.DrawGeometry(null,Stroke(color,13,0.23),g);
                dc.DrawGeometry(null,Stroke(color,3.5,0.82),g);
            }
            for(int i=0;i<100*Settings.Density;i++) {
                double x=Scatter(i,3)*w;
                double y=Frac(Scatter(i,4)-t*(0.018+(i%4)*0.005))*h;
                double s=2+(i%4),a=Math.Round((0.4+0.5*(1+Math.Sin(t*0.7+i))/2)*12)/12;
                if(i%5==0) {
                    dc.PushTransform(new RotateTransform(t*15+i*30,x,y));
                    dc.DrawRectangle(null,Stroke(i,1.6,a),new Rect(x-s*2,y-s*2,s*4,s*4));dc.Pop();
                } else { dc.DrawEllipse(Tint(i,a),null,new Point(x,y),s,s); }
            }
        }
        private void Synthwave(DrawingContext dc,double w,double h,double t) {
            double horizon=h*0.57,cx=w*0.54,sunY=h*0.28,sunR=Math.Min(w*0.16,h*0.23);
            Glow(dc,cx,sunY,sunR*2.5,0,0.35);Glow(dc,w*0.13,h*0.85,h*0.45,3,0.28);
            var sun=new LinearGradientBrush(colors[6].Color,colors[0].Color,new Point(0,0),new Point(0,1));sun.Freeze();
            var stripes=new GeometryGroup();
            for(int i=0;i<15;i++)stripes.Children.Add(new RectangleGeometry(new Rect(cx-sunR,sunY-sunR+i*sunR*2/15,sunR*2,sunR*2/15*(i<5?0.94:0.63))));
            stripes.Freeze();dc.PushClip(stripes);dc.PushOpacity(0.75);
            dc.DrawEllipse(sun,null,new Point(cx,sunY),sunR,sunR);dc.Pop();dc.Pop();
            for(int i=0;i<55*Settings.Density;i++) {
                double x=Frac(Scatter(i,5)+t*0.003)*w,y=Scatter(i,6)*horizon;
                double s=i%9==0?3:1.4;
                dc.DrawEllipse(colors[i%8],null,new Point(x,y),s,s);
            }
            for(int ridge=0;ridge<3;ridge++) {
                var pts=new Point[45];
                for(int i=0;i<45;i++) {
                    double x=w*i/44.0;
                    double profile=Math.Abs(Math.Sin(i*0.92+ridge*1.4))*0.14+Math.Abs(Math.Cos(i*0.37))*0.06;
                    pts[i]=new Point(x,horizon-profile*h*(1-ridge*0.2)+ridge*12);
                }
                NeonPath(dc,Path(pts,false),ridge==0?1:3,0.6);
            }
            dc.PushClip(new RectangleGeometry(new Rect(0,horizon,w,h-horizon)));
            int lines=(int)(12+8*Settings.Density);
            for(int i=-lines;i<=lines;i++) {
                var pts=new[]{new Point(cx,horizon),new Point(cx+i*w*0.10,h*1.1)};
                NeonPath(dc,Path(pts,false),i%2==0?0:3,0.7);
            }
            for(int i=0;i<20;i++) {
                double p=Frac(i/20.0+t*0.05);
                double y=horizon+(h-horizon)*p*p;
                NeonPath(dc,Path(new[]{new Point(0,y),new Point(w,y)},false),i%2==0?0:1,0.75);
            }
            dc.Pop();
            NeonPath(dc,Path(new[]{new Point(0,horizon),new Point(w,horizon)},false),3,1);
        }
        private void Jellyfish(DrawingContext dc,double w,double h,double t) {
            Glow(dc,w*0.1,h*0.7,h*0.55,1,0.26);Glow(dc,w*0.85,h*0.2,h*0.5,3,0.25);
            for(int i=0;i<55*Settings.Density;i++) {
                double x=Scatter(i,7)*w,y=Frac(Scatter(i,8)-t*0.015)*h;
                dc.DrawEllipse(null,Stroke(i,1.6,0.35),new Point(x,y),2+i%3,2+i%3);
            }
            int count=(int)(4+Settings.Density*4);
            for(int i=0;i<count;i++) {
                double x=w*(0.08+0.84*Scatter(i,9))+Math.Sin(t*0.27+i)*w*0.035;
                double y=Frac(Scatter(i,10)+0.15-t*(0.016+i%3*0.003))*(h+210)-100;
                double size=Math.Min(w,h)*(0.045+(i%4)*0.012);
                double pulse=1+0.09*Math.Sin(t*1.2+i);
                int color=(i*3)%8;
                Glow(dc,x,y,size*2.4,color,0.45);
                for(int strand=0;strand<8;strand++) {
                    var pts=new Point[28];
                    for(int k=0;k<28;k++) {
                        double p=k/27.0;
                        pts[k]=new Point(x+(strand-3.5)*size*0.2+Math.Sin(p*7-t*1.3+i+strand*0.4)*size*0.27*p,y+size*0.2+p*size*(2.2+strand%3*0.4));
                    }
                    NeonPath(dc,Path(pts,false),(color+strand/3)%8,0.65*(1-strand%2*0.2));
                }
                var bell=new StreamGeometry();
                using(var c=bell.Open()) {
                    c.BeginFigure(new Point(x-size*pulse,y+size*0.2),true,true);
                    c.BezierTo(new Point(x-size*pulse,y-size*1.2),new Point(x+size*pulse,y-size*1.2),new Point(x+size*pulse,y+size*0.2),true,false);
                    c.BezierTo(new Point(x+size*0.35,y-size*0.1),new Point(x-size*0.35,y+size*0.45),new Point(x-size*pulse,y+size*0.2),true,false);
                }
                bell.Freeze();
                dc.PushOpacity(0.55);dc.DrawGeometry(glows[color],boldPens[color],bell);dc.Pop();
                NeonPath(dc,bell,color,0.85);
                for(int dot=0;dot<5;dot++)dc.DrawEllipse(colors[(color+2)%8],null,new Point(x+(dot-2)*size*0.28,y-size*0.23-Math.Cos(dot-2)*size*0.12),2.3,2.3);
            }
        }
    }
}
