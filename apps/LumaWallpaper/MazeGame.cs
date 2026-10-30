using System;
using System.Collections.Generic;

namespace LumaWallpaper {
    // Deterministic grid simulation. Actors interpolate between legal adjacent cells.
    internal sealed class MazeGame {
        public const int Width=27, Height=23;
        public const double TickSeconds=0.17;
        public readonly bool[] Walls=new bool[Width*Height];
        public readonly bool[] Pellets=new bool[Width*Height];
        public readonly bool[] Power=new bool[Width*Height];
        public readonly int[][] Routes=new int[Width*Height][];
        private readonly int[] visits=new int[Width*Height];
        private readonly int[] spawns=new int[4];
        public readonly int[] Ghosts=new int[4],GhostFrom=new int[4],GhostGrace=new int[4];
        public int Player,PlayerFrom,Ticks,Score,Level=1,Lives=3,Frightened,Grace;
        public int Eaten,PowerEaten,Deaths,GhostsEaten,Remaining;
        public string Event="READY";
        public MazeGame() { Build(); ResetPellets(); Respawn(); }
        private void Build() {
            for(int y=0;y<Height;y++)for(int x=0;x<Width;x++)Walls[y*Width+x]=x==0||y==0||x==Width-1||y==Height-1||(x%2==0&&y%2==0);
            var random=new Random(1303);
            for(int y=1;y<Height-1;y++)for(int x=1;x<Width-1;x++) {
                int cell=y*Width+x;
                if((x%2==0 ^ y%2==0) && random.NextDouble()<0.35) {
                    Walls[cell]=true;if(!Connected())Walls[cell]=false;
                }
            }
            for(int n=0;n<Walls.Length;n++)Routes[n]=Neighbors(n).ToArray();
            spawns[0]=Nearest(Width/2,Height/2);spawns[1]=Nearest(Width/2-4,Height/2);
            spawns[2]=Nearest(Width/2+4,Height/2);spawns[3]=Nearest(Width/2,Height/2-4);
        }
        private int Nearest(int x,int y) {
            int best=0,dist=int.MaxValue;
            for(int n=0;n<Walls.Length;n++)if(!Walls[n]) {int d=Math.Abs(n%Width-x)+Math.Abs(n/Width-y);if(d<dist){dist=d;best=n;}}
            return best;
        }
        private List<int> Neighbors(int n) {
            var result=new List<int>(4);if(Walls[n])return result;
            foreach(int d in new[]{-1,1,-Width,Width}) {int p=n+d;if(p>=0&&p<Walls.Length&&!Walls[p]&&Math.Abs(p%Width-n%Width)+Math.Abs(p/Width-n/Width)==1)result.Add(p);}
            return result;
        }
        private bool Connected() {
            var seen=new bool[Walls.Length];var q=new Queue<int>();q.Enqueue(Width+1);seen[Width+1]=true;
            while(q.Count>0)foreach(int n in Neighbors(q.Dequeue()))if(!seen[n]){seen[n]=true;q.Enqueue(n);}
            for(int n=0;n<Walls.Length;n++)if(!Walls[n]&&!seen[n])return false;return true;
        }
        private void ResetPellets() {
            Remaining=0;Array.Clear(visits,0,visits.Length);
            for(int n=0;n<Walls.Length;n++){Pellets[n]=!Walls[n];Power[n]=false;if(Pellets[n])Remaining++;}
            foreach(int n in new[]{Width+1,Width*2-2,Width*(Height-2)+1,Width*(Height-1)-2})Power[n]=true;
        }
        private void Respawn() {
            Player=PlayerFrom=Nearest(Width/2,Height-2);
            for(int g=0;g<4;g++){Ghosts[g]=GhostFrom[g]=spawns[g];GhostGrace[g]=5;}
            Grace=10;Frightened=0;
        }
        private int[] Distances(int source,bool pellets) {
            var dist=new int[Walls.Length];for(int n=0;n<dist.Length;n++)dist[n]=10000;
            var q=new Queue<int>();
            if(pellets) {for(int n=0;n<dist.Length;n++)if(Pellets[n]){dist[n]=0;q.Enqueue(n);}}
            else {dist[source]=0;q.Enqueue(source);}
            while(q.Count>0) {int n=q.Dequeue();foreach(int p in Routes[n])if(dist[p]>dist[n]+1){dist[p]=dist[n]+1;q.Enqueue(p);}}
            return dist;
        }
        public void Step() {
            Ticks++;if(Frightened>0)Frightened--;if(Grace>0)Grace--;
            for(int g=0;g<4;g++)if(GhostGrace[g]>0)GhostGrace[g]--;
            int previous=PlayerFrom;PlayerFrom=Player;
            int[] food=Distances(Player,true);var threat=new int[4][];
            for(int g=0;g<4;g++)threat[g]=Distances(Ghosts[g],false);
            double best=Double.MaxValue;int move=Player;
            foreach(int n in Routes[Player]) {
                double cost=food[n]*2+Math.Min(12,visits[n])*0.22+(n==previous?0.6:0);
                if(Frightened==0&&Grace==0)for(int g=0;g<4;g++)if(GhostGrace[g]==0&&threat[g][n]<5)cost+=(5-threat[g][n])*5;
                if(Power[n]&&Pellets[n])cost-=3;
                cost+=((n*17+Ticks*3)%11)*0.001;
                if(cost<best){best=cost;move=n;}
            }
            Player=move;visits[Player]++;
            if(Pellets[Player]) {Pellets[Player]=false;Remaining--;Eaten++;Score+=Power[Player]?50:10;
                if(Power[Player]){PowerEaten++;Frightened=45;Event="POWER UP";}
            }
            int[] chase=Distances(Player,false);
            for(int g=0;g<4;g++) {
                int old=GhostFrom[g];GhostFrom[g]=Ghosts[g];
                if((Ticks+g)%5==0||(Frightened>0&&(Ticks+g)%2==0))continue;
                double chosen=Double.MaxValue;int destination=Ghosts[g];
                foreach(int n in Routes[Ghosts[g]]) {
                    if(n==old&&Routes[Ghosts[g]].Length>1)continue;
                    double cost=Frightened>0?-chase[n]:chase[n];
                    // Brief scatter periods stop all four ghosts from forming one queue.
                    if(Frightened==0 && Ticks%120<22)cost=Math.Abs(n%Width-(g%2==0?1:Width-2))+Math.Abs(n/Width-(g<2?1:Height-2));
                    cost+=((n*13+g*7+Ticks)%9)*0.04;
                    if(cost<chosen){chosen=cost;destination=n;}
                }
                Ghosts[g]=destination;
            }
            ResolveCollisions();
            if(Remaining==0){Level++;ResetPellets();Respawn();Event="NEXT LEVEL";}
            else if(Frightened==0&&Grace==0)Event="AUTO PLAY";
        }
        internal void ResolveCollisions() {
            if(Grace>0)return;
            for(int g=0;g<4;g++)if(GhostGrace[g]==0&&(Player==Ghosts[g]||(Player==GhostFrom[g]&&PlayerFrom==Ghosts[g]))) {
                if(Frightened>0){Score+=200;GhostsEaten++;Ghosts[g]=GhostFrom[g]=spawns[g];GhostGrace[g]=15;Event="GHOST +200";}
                else {Lives--;Deaths++;Event=Lives<=0?"NEW GAME":"TRY AGAIN";
                    if(Lives<=0){Lives=3;Score=0;Level=1;ResetPellets();}
                    Respawn();break;
                }
            }
        }
    }
}
