import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowRight, Loader2, CreditCard, User, Calendar, Clock, Check, Plus } from "lucide-react";
import { format } from "date-fns";
import { CartItem } from "./PublicBookingCart";

interface PersonDetails {
  name: string;
  phone: string;
  email: string;
  notes: string;
  assignedServiceIds: string[];
}

interface PublicGroupCustomerFormProps {
  cartItems: CartItem[];
  currency: string;
  personCount: number;
  collectDuringBooking: boolean;
  hasStripe: boolean;
  onSubmit: (people: PersonDetails[]) => Promise<void>;
  onBack: () => void;
  onAddService: () => void;
}

const formatCurrency = (amount: number, currency: string) => {
  const symbols: Record<string, string> = {
    GBP: "£",
    USD: "$",
    EUR: "€",
  };
  return `${symbols[currency] || currency}${amount.toFixed(2)}`;
};

export const PublicGroupCustomerForm = ({
  cartItems,
  currency,
  personCount,
  collectDuringBooking,
  hasStripe,
  onSubmit,
  onBack,
  onAddService,
}: PublicGroupCustomerFormProps) => {
  const [currentPerson, setCurrentPerson] = useState(0);
  const [people, setPeople] = useState<PersonDetails[]>(() =>
    Array.from({ length: personCount }, () => ({
      name: "",
      phone: "",
      email: "",
      notes: "",
      assignedServiceIds: [],
    }))
  );
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Auto-assign services to people if counts match
  useEffect(() => {
    if (cartItems.length === personCount) {
      setPeople((prev) =>
        prev.map((person, index) => ({
          ...person,
          assignedServiceIds: [cartItems[index].id],
        }))
      );
    }
  }, [cartItems.length, personCount]);

  const currentPersonData = people[currentPerson];

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!currentPersonData.name.trim() || currentPersonData.name.trim().length < 2) {
      newErrors.name = "Please enter full name";
    }

    if (!currentPersonData.phone.trim()) {
      newErrors.phone = "Phone number is required";
    } else if (!/^[+\d\s()-]{8,}$/.test(currentPersonData.phone)) {
      newErrors.phone = "Please enter a valid phone number";
    }

    if (currentPersonData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(currentPersonData.email)) {
      newErrors.email = "Please enter a valid email";
    }

    if (currentPersonData.assignedServiceIds.length === 0) {
      newErrors.services = "Please assign at least one service";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleUpdatePerson = (field: keyof PersonDetails, value: string | string[]) => {
    setPeople((prev) =>
      prev.map((person, index) =>
        index === currentPerson ? { ...person, [field]: value } : person
      )
    );
  };

  const handleToggleService = (itemId: string) => {
    const currentIds = currentPersonData.assignedServiceIds;
    const newIds = currentIds.includes(itemId)
      ? currentIds.filter((id) => id !== itemId)
      : [...currentIds, itemId];
    handleUpdatePerson("assignedServiceIds", newIds);
  };

  const isServiceAssigned = (itemId: string) => {
    return people.some((person, index) =>
      index !== currentPerson && person.assignedServiceIds.includes(itemId)
    );
  };

  const handleNext = () => {
    if (!validate()) return;
    if (currentPerson < personCount - 1) {
      setCurrentPerson((prev) => prev + 1);
      setErrors({});
    }
  };

  const handlePrevious = () => {
    if (currentPerson > 0) {
      setCurrentPerson((prev) => prev - 1);
      setErrors({});
    }
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      await onSubmit(people);
    } finally {
      setLoading(false);
    }
  };

  const isLastPerson = currentPerson === personCount - 1;

  // Calculate deposit info
  const assignedItems = cartItems.filter((item) =>
    currentPersonData.assignedServiceIds.includes(item.id)
  );
  const totalDeposit = assignedItems
    .filter((item) => item.service.deposit_required && item.service.deposit_amount)
    .reduce((sum, item) => sum + (item.service.deposit_amount || 0), 0);
  const willPayNow = totalDeposit > 0 && collectDuringBooking && hasStripe;

  return (
    <div className="space-y-6">
      <Button variant="outline" onClick={currentPerson > 0 ? handlePrevious : onBack} className="gap-2" disabled={loading}>
        <ArrowLeft className="h-4 w-4" />
        {currentPerson > 0 ? `Back to Person ${currentPerson}` : "Back"}
      </Button>

      {/* Progress indicator */}
      <div className="flex items-center justify-center gap-2">
        {Array.from({ length: personCount }, (_, i) => (
          <div
            key={i}
            className={`flex items-center justify-center h-8 w-8 rounded-full text-sm font-medium transition-colors ${
              i === currentPerson
                ? "bg-primary text-primary-foreground"
                : i < currentPerson
                ? "bg-green-500 text-white"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {i < currentPerson ? <Check className="h-4 w-4" /> : i + 1}
          </div>
        ))}
      </div>

      <div className="text-center">
        <h2 className="text-xl font-semibold">Person {currentPerson + 1} of {personCount}</h2>
        <p className="text-muted-foreground">Enter details and select their service(s)</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Service Assignment */}
        <Card className="border-2 border-primary shadow-sm bg-secondary">
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span>Assign Services</span>
              <Button variant="ghost" size="sm" onClick={onAddService} className="gap-1 text-xs">
                <Plus className="h-3 w-3" />
                Add Service
              </Button>
            </CardTitle>
            <CardDescription>Select which services this person is booking</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {cartItems.map((item) => {
              const isAssignedToOther = isServiceAssigned(item.id);
              const isSelected = currentPersonData.assignedServiceIds.includes(item.id);
              
              return (
                <div
                  key={item.id}
                  onClick={() => !isAssignedToOther && handleToggleService(item.id)}
                  className={`p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                    isSelected
                      ? "border-primary bg-primary/5"
                      : isAssignedToOther
                      ? "border-muted bg-muted/50 cursor-not-allowed opacity-50"
                      : "border-transparent hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium">{item.service.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.service.duration_minutes} min • {formatCurrency(item.service.price, currency)}
                      </p>
                      {item.staff && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <User className="h-3 w-3" />
                          {item.staff.name}
                        </p>
                      )}
                      {item.date && item.time && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(item.date, "EEE, MMM d")} at {item.time}
                        </p>
                      )}
                    </div>
                    <div className={`h-5 w-5 rounded border-2 flex items-center justify-center ${
                      isSelected ? "bg-primary border-primary" : "border-muted-foreground"
                    }`}>
                      {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                    </div>
                  </div>
                  {isAssignedToOther && (
                    <p className="text-xs text-muted-foreground mt-1">Already assigned to another person</p>
                  )}
                </div>
              );
            })}
            {errors.services && (
              <p className="text-sm text-destructive">{errors.services}</p>
            )}
          </CardContent>
        </Card>

        {/* Customer Details */}
        <Card className="border-2 border-primary shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Person {currentPerson + 1} Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={currentPersonData.phone}
                  onChange={(e) => handleUpdatePerson("phone", e.target.value)}
                  placeholder="+44 7123 456789"
                  className="border-2"
                  disabled={loading}
                />
                {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  value={currentPersonData.name}
                  onChange={(e) => handleUpdatePerson("name", e.target.value)}
                  placeholder="John Smith"
                  className="border-2"
                  disabled={loading}
                />
                {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email (optional)</Label>
                <Input
                  id="email"
                  type="email"
                  value={currentPersonData.email}
                  onChange={(e) => handleUpdatePerson("email", e.target.value)}
                  placeholder="john@example.com"
                  className="border-2"
                  disabled={loading}
                />
                {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  value={currentPersonData.notes}
                  onChange={(e) => handleUpdatePerson("notes", e.target.value)}
                  placeholder="Any special requests..."
                  className="border-2"
                  rows={2}
                  disabled={loading}
                />
              </div>

              {isLastPerson ? (
                <Button
                  onClick={handleSubmit}
                  className="w-full"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : willPayNow ? (
                    <>
                      <CreditCard className="h-4 w-4 mr-2" />
                      Pay Deposit & Book
                    </>
                  ) : (
                    "Confirm All Bookings"
                  )}
                </Button>
              ) : (
                <Button onClick={handleNext} className="w-full gap-2" disabled={loading}>
                  Next Person
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
