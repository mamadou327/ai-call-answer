import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TaskNotificationRequest {
  taskTitle: string;
  taskDescription: string | null;
  taskPriority: string;
  taskDueDate: string | null;
  staffId: string;
  businessId: string;
}

const getPriorityColor = (priority: string): string => {
  switch (priority) {
    case "urgent": return "#ef4444";
    case "high": return "#f97316";
    case "medium": return "#3b82f6";
    case "low": return "#64748b";
    default: return "#64748b";
  }
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      taskTitle,
      taskDescription,
      taskPriority,
      taskDueDate,
      staffId,
      businessId,
    }: TaskNotificationRequest = await req.json();

    console.log("Task notification request:", { taskTitle, staffId, businessId });

    // Get staff email
    const { data: staff, error: staffError } = await supabase
      .from("staff")
      .select("name, email")
      .eq("id", staffId)
      .single();

    if (staffError || !staff) {
      console.error("Failed to find staff:", staffError);
      return new Response(
        JSON.stringify({ error: "Staff not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!staff.email) {
      console.log("Staff has no email configured:", staffId);
      return new Response(
        JSON.stringify({ success: false, message: "Staff has no email configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get business name
    const { data: business } = await supabase
      .from("businesses")
      .select("business_name")
      .eq("id", businessId)
      .single();

    const businessName = business?.business_name || "Your Business";
    const priorityColor = getPriorityColor(taskPriority);
    const dueDateFormatted = taskDueDate 
      ? new Date(taskDueDate).toLocaleDateString("en-US", { 
          weekday: "long", 
          year: "numeric", 
          month: "long", 
          day: "numeric" 
        })
      : null;

    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev";

    // Send email using Resend API
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `Aivia <${fromEmail}>`,
        to: [staff.email],
        subject: `New Task Assigned: ${taskTitle}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">New Task Assigned</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">${businessName}</p>
            </div>
            
            <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef; border-top: none;">
              <p style="margin: 0 0 20px 0;">Hi ${staff.name},</p>
              
              <p style="margin: 0 0 20px 0;">You have been assigned a new task:</p>
              
              <div style="background: white; border-radius: 8px; padding: 20px; margin-bottom: 20px; border: 1px solid #e9ecef;">
                <div style="margin-bottom: 15px;">
                  <h2 style="margin: 0; font-size: 18px; color: #1a1a1a;">${taskTitle}</h2>
                </div>
                
                <div style="margin-bottom: 15px;">
                  <span style="background: ${priorityColor}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase;">
                    ${taskPriority}
                  </span>
                </div>
                
                ${taskDescription ? `
                  <div style="margin-bottom: 15px;">
                    <p style="color: #666; margin: 0; font-size: 14px;">${taskDescription}</p>
                  </div>
                ` : ''}
                
                ${dueDateFormatted ? `
                  <div style="background: #f1f5f9; padding: 10px 15px; border-radius: 6px;">
                    <p style="margin: 0; font-size: 14px; color: #475569;">
                      <strong>Due:</strong> ${dueDateFormatted}
                    </p>
                  </div>
                ` : ''}
              </div>
              
              <p style="margin: 0 0 20px 0; color: #666;">
                Log in to your staff dashboard to view and complete this task.
              </p>
              
              <p style="margin: 20px 0 0 0; color: #999; font-size: 12px;">
                This is an automated message from Aivia. Please do not reply to this email.
              </p>
            </div>
          </body>
          </html>
        `,
      }),
    });

    const emailResult = await emailResponse.json();

    if (!emailResponse.ok) {
      console.error("Failed to send email:", emailResult);
      return new Response(
        JSON.stringify({ error: "Failed to send email", details: emailResult }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Email sent successfully:", emailResult);

    return new Response(
      JSON.stringify({ success: true, emailId: emailResult.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-task-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
