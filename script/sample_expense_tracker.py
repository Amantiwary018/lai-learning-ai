"""Personal Expense Tracker - add, list, summarise and persist expenses to CSV."""
import csv
import os
from datetime import date, datetime

FILE = "expenses.csv"
FIELDS = ["amount", "category", "date", "note"]


def load_expenses(path=FILE):
    if not os.path.exists(path):
        return []
    with open(path, newline="", encoding="utf-8") as f:
        return [{**row, "amount": float(row["amount"])} for row in csv.DictReader(f)]


def save_expenses(expenses, path=FILE):
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(expenses)


def add_expense(expenses):
    try:
        amount = float(input("Amount: "))
        if amount <= 0:
            raise ValueError
    except ValueError:
        print("Please enter a positive number.")
        return
    category = input("Category (food/travel/bills/other): ").strip().lower() or "other"
    raw = input("Date YYYY-MM-DD (blank = today): ").strip()
    try:
        d = datetime.strptime(raw, "%Y-%m-%d").date() if raw else date.today()
    except ValueError:
        print("Invalid date format.")
        return
    expenses.append({"amount": amount, "category": category, "date": d.isoformat(), "note": input("Note: ").strip()})
    save_expenses(expenses)
    print("Saved.")


def list_expenses(expenses):
    if not expenses:
        print("No expenses yet.")
        return
    print(f"{'Date':<12}{'Category':<12}{'Amount':>10}  Note")
    for e in sorted(expenses, key=lambda e: e["date"]):
        print(f"{e['date']:<12}{e['category']:<12}{e['amount']:>10.2f}  {e['note']}")


def totals_by_category(expenses):
    totals = {}
    for e in expenses:
        totals[e["category"]] = totals.get(e["category"], 0) + e["amount"]
    for cat, total in sorted(totals.items(), key=lambda kv: -kv[1]):
        print(f"{cat:<12}{total:>10.2f}")
    print(f"{'TOTAL':<12}{sum(totals.values()):>10.2f}")
    return totals


def main():
    expenses = load_expenses()
    actions = {"1": add_expense, "2": list_expenses, "3": totals_by_category}
    while True:
        choice = input("\n1) Add  2) List  3) Totals  4) Quit: ").strip()
        if choice == "4":
            break
        action = actions.get(choice)
        action(expenses) if action else print("Choose 1-4.")


if __name__ == "__main__":
    main()
