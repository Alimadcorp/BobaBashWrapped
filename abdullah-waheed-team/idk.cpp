
#include <iostream>
using namespace std;

int main() {
int x = 10;
    int* ptr = &x;      // initialize the pointer and assigns it the memory address of x
    int** pptr = &ptr;  // initialize another parent pointer and assigns it the memory address of pointer
    cout << &ptr << endl; //prints memory address of pointer
    cout << &pptr << endl;  // prints memory address of parent pointer
    
    cout << *ptr << endl;  // prints the value stored at pointer i.e. the value of x
    cout << ptr << endl;  //  prints the pointer i.e. the adress of x
    cout<< &x; << endl;    //  // prints the adress of x
    cout << **(pptr) << endl;    //   prints the value stored at pointer adress i.e. the value of x
    cout << **(&pptr) << endl;    //   prints the value stored at pointer i.e. the adress of x
    
    return 0;
}