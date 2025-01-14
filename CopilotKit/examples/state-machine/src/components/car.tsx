export interface CarProps {
    make: string;
    model: string;
    year: string;
    color: string;
}

export default function Car({ make, model, year, color }: CarProps) {
  <div className="w-[500px] h-[500px] border rounded-lg p-6 bg-white shadow-lg"> 
    <h2 className="text-2xl font-bold mb-6 text-gray-800">Car Configuration</h2>
    <div className="space-y-4">
      <div className="border-b pb-2">
        <p className="text-sm text-gray-500">Make</p>
        <p className="text-lg font-medium">{make || 'Not selected'}</p>
      </div>
      <div className="border-b pb-2">
        <p className="text-sm text-gray-500">Model</p>
        <p className="text-lg font-medium">{model || 'Not selected'}</p>
      </div>
      <div className="border-b pb-2">
        <p className="text-sm text-gray-500">Year</p>
        <p className="text-lg font-medium">{year || 'Not selected'}</p>
      </div>
      <div className="border-b pb-2">
        <p className="text-sm text-gray-500">Color</p>
        <div className="flex items-center gap-2">
          <p className="text-lg font-medium">{color || 'Not selected'}</p>
          {color && (
            <div 
              className="w-6 h-6 rounded-full border"
              style={{ backgroundColor: color }}
            />
          )}
        </div>
      </div>
    </div>
  </div>
}