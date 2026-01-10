import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, MapPin, Phone, Copy, Home } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PublicOrderConfirmationProps {
  orderNumber: string;
  businessName: string;
  businessAddress: string;
  businessPhone: string;
  orderType: "pickup" | "delivery";
  estimatedTime?: string;
  total: number;
  currency: string;
  onBackToHome: () => void;
}

const formatCurrency = (amount: number, currency: string) => {
  const symbol = currency === "GBP" ? "£" : currency === "EUR" ? "€" : "$";
  return `${symbol}${amount.toFixed(2)}`;
};

export const PublicOrderConfirmation = ({
  orderNumber,
  businessName,
  businessAddress,
  businessPhone,
  orderType,
  estimatedTime,
  total,
  currency,
  onBackToHome,
}: PublicOrderConfirmationProps) => {
  const { toast } = useToast();

  const copyOrderNumber = () => {
    navigator.clipboard.writeText(orderNumber);
    toast({ title: "Copied!", description: "Order number copied to clipboard" });
  };

  return (
    <div className="space-y-6 text-center">
      <div className="flex justify-center">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle className="h-12 w-12 text-green-600" />
        </div>
      </div>
      
      <div>
        <h2 className="text-2xl font-bold">Order Placed!</h2>
        <p className="text-muted-foreground">Thank you for your order</p>
      </div>
      
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Order Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-center gap-2">
            <span className="text-2xl font-mono font-bold">{orderNumber}</span>
            <Button variant="ghost" size="sm" onClick={copyOrderNumber}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          
          <Badge variant="secondary" className="text-sm">
            {orderType === "pickup" ? "Pickup Order" : "Delivery Order"}
          </Badge>
          
          {estimatedTime && (
            <div className="flex items-center justify-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>Estimated ready: {estimatedTime}</span>
            </div>
          )}
          
          <div className="pt-2 border-t">
            <p className="font-semibold text-lg">Total: {formatCurrency(total, currency)}</p>
            <p className="text-sm text-muted-foreground">Pay at {orderType === "pickup" ? "pickup" : "delivery"}</p>
          </div>
        </CardContent>
      </Card>
      
      {orderType === "pickup" && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center justify-center gap-2">
              <MapPin className="h-4 w-4" />
              Pickup Location
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{businessName}</p>
            <p className="text-sm text-muted-foreground">{businessAddress}</p>
            <Button variant="link" className="mt-2" asChild>
              <a href={`tel:${businessPhone}`}>
                <Phone className="h-4 w-4 mr-2" />
                {businessPhone}
              </a>
            </Button>
          </CardContent>
        </Card>
      )}
      
      <div className="pt-4">
        <p className="text-sm text-muted-foreground mb-4">
          You'll receive a text message when your order is ready
        </p>
        <Button onClick={onBackToHome} variant="outline" className="w-full">
          <Home className="h-4 w-4 mr-2" />
          Back to Home
        </Button>
      </div>
    </div>
  );
};
