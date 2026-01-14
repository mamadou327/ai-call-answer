const DeviceMockup = () => {
  return (
    <div className="relative w-full max-w-5xl mx-auto mt-16 px-4">
      {/* Laptop Frame */}
      <div className="relative animate-float">
        {/* Screen */}
        <div className="relative bg-muted border-4 border-foreground rounded-t-lg overflow-hidden shadow-lg">
          {/* Browser Chrome */}
          <div className="bg-secondary border-b-2 border-foreground px-4 py-2 flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-destructive border border-foreground" />
              <div className="w-3 h-3 rounded-full bg-warning border border-foreground" />
              <div className="w-3 h-3 rounded-full bg-success border border-foreground" />
            </div>
            <div className="flex-1 mx-4">
              <div className="bg-background border-2 border-foreground px-3 py-1 text-xs text-muted-foreground font-mono">
                dashboard.aivia.app
              </div>
            </div>
          </div>
          
          {/* Dashboard Content */}
          <div className="bg-background p-4 md:p-6 min-h-[280px] md:min-h-[320px]">
            {/* Header */}
            <div className="flex items-center justify-between mb-4 md:mb-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-foreground rounded" />
                <span className="font-bold text-sm md:text-base">AIVIA Dashboard</span>
              </div>
              <div className="flex gap-2">
                <div className="px-3 py-1 bg-muted border-2 border-foreground text-xs font-medium">Bookings</div>
                <div className="px-3 py-1 bg-muted border-2 border-foreground text-xs font-medium hidden sm:block">Calls</div>
                <div className="px-3 py-1 bg-muted border-2 border-foreground text-xs font-medium hidden md:block">Settings</div>
              </div>
            </div>
            
            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-3 md:gap-4 mb-4 md:mb-6">
              <div className="bg-secondary border-2 border-foreground p-3 md:p-4 shadow-xs">
                <div className="text-xs text-muted-foreground mb-1">Today's Calls</div>
                <div className="text-xl md:text-2xl font-bold">127</div>
                <div className="text-xs text-success mt-1">↑ 23%</div>
              </div>
              <div className="bg-secondary border-2 border-foreground p-3 md:p-4 shadow-xs">
                <div className="text-xs text-muted-foreground mb-1">Revenue</div>
                <div className="text-xl md:text-2xl font-bold">£2.4k</div>
                <div className="text-xs text-success mt-1">↑ 18%</div>
              </div>
              <div className="bg-secondary border-2 border-foreground p-3 md:p-4 shadow-xs">
                <div className="text-xs text-muted-foreground mb-1">Answered</div>
                <div className="text-xl md:text-2xl font-bold">95%</div>
                <div className="text-xs text-success mt-1">↑ 12%</div>
              </div>
            </div>
            
            {/* Chart Placeholder */}
            <div className="bg-muted border-2 border-foreground p-4 h-20 md:h-24 flex items-end gap-1">
              {[40, 65, 45, 80, 55, 70, 90, 60, 75, 85, 50, 95].map((height, i) => (
                <div 
                  key={i} 
                  className="flex-1 bg-foreground transition-all"
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
          </div>
        </div>
        
        {/* Laptop Base */}
        <div className="relative">
          <div className="h-4 bg-secondary border-x-4 border-b-4 border-foreground rounded-b-lg" />
          <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-1/4 h-1 bg-muted border-2 border-foreground rounded-b" />
        </div>
      </div>
      
      {/* Phone Frame - Positioned to the right */}
      <div className="absolute -right-2 md:right-8 bottom-8 md:bottom-12 w-28 md:w-36 animate-float-delayed">
        {/* Phone Body */}
        <div className="bg-foreground rounded-2xl p-1.5 shadow-md">
          {/* Phone Screen */}
          <div className="bg-background rounded-xl overflow-hidden">
            {/* Status Bar */}
            <div className="bg-secondary px-3 py-1.5 flex justify-between items-center text-[8px] border-b border-foreground">
              <span>9:41</span>
              <div className="flex gap-1">
                <div className="w-3 h-1.5 bg-foreground rounded-sm" />
              </div>
            </div>
            
            {/* Phone Content */}
            <div className="p-2 space-y-2">
              <div className="text-[10px] font-bold">AIVIA</div>
              
              {/* Mini Stats */}
              <div className="grid grid-cols-2 gap-1.5">
                <div className="bg-muted border border-foreground p-1.5">
                  <div className="text-[7px] text-muted-foreground">Calls</div>
                  <div className="text-xs font-bold">127</div>
                </div>
                <div className="bg-muted border border-foreground p-1.5">
                  <div className="text-[7px] text-muted-foreground">Revenue</div>
                  <div className="text-xs font-bold">£2.4k</div>
                </div>
              </div>
              
              {/* Mini Chart */}
              <div className="bg-muted border border-foreground p-1.5 h-12 flex items-end gap-0.5">
                {[40, 65, 80, 55, 90, 60].map((height, i) => (
                  <div 
                    key={i} 
                    className="flex-1 bg-foreground"
                    style={{ height: `${height}%` }}
                  />
                ))}
              </div>
              
              {/* Booking Preview */}
              <div className="bg-secondary border border-foreground p-1.5">
                <div className="text-[7px] text-muted-foreground">Next Booking</div>
                <div className="text-[9px] font-medium">Sarah M. - 2:30 PM</div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Phone Notch */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1 bg-foreground rounded-full" />
      </div>
    </div>
  );
};

export default DeviceMockup;
